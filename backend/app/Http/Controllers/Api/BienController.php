<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bien;
use App\Models\JournalActivite;
use App\Models\ParametreAgence;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class BienController extends Controller
{
    /** Types de biens acceptés */
    public const TYPES = ['appartement', 'villa', 'studio', 'chambre', 'bureau', 'magasin'];

    /**
     * Liste paginée avec filtres.
     * GET /api/biens?recherche=almadies&statut=libre&type=villa&proprietaire_id=1&page=1
     */
    public function index(Request $request): JsonResponse
    {
        $recherche = trim((string) $request->query('recherche', ''));

        $biens = Bien::with(['proprietaire.user', 'photos'])
            ->withCount('photos')
            ->when($recherche !== '', function ($q) use ($recherche) {
                $q->where(function ($w) use ($recherche) {
                    $w->where('titre', 'ilike', "%{$recherche}%")
                      ->orWhere('reference', 'ilike', "%{$recherche}%")
                      ->orWhere('quartier', 'ilike', "%{$recherche}%")
                      ->orWhere('adresse', 'ilike', "%{$recherche}%");
                });
            })
            ->when($request->filled('statut'), fn ($q) => $q->where('statut', $request->query('statut')))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->query('type')))
            ->when($request->filled('proprietaire_id'), fn ($q) => $q->where('proprietaire_id', $request->query('proprietaire_id')))
            ->latest()
            ->paginate(12);

        $biens->getCollection()->transform(fn ($b) => $this->formater($b));

        return response()->json($biens);
    }

    /**
     * Création d'un bien (statut « libre », non publié).
     */
    public function store(Request $request): JsonResponse
    {
        $donnees = $this->normaliser($request->validate($this->regles()));

        $bien = DB::transaction(function () use ($donnees, $request) {
            $bien = Bien::create($donnees + [
                'reference' => $this->nouvelleReference(),
                'statut' => Bien::STATUT_LIBRE,
                'publie' => false,
            ]);
            $this->journaliser($request, 'creation', $bien);

            return $bien;
        });

        return response()->json([
            'message' => 'Bien créé avec succès. Ajoutez des photos pour pouvoir le publier.',
            'bien' => $this->formater($bien->load(['proprietaire.user', 'photos'])->loadCount('photos')),
        ], 201);
    }

    /**
     * Détail d'un bien : photos, propriétaire et bail en cours.
     */
    public function show(Bien $bien): JsonResponse
    {
        $bien->load(['proprietaire.user', 'photos', 'bailActif.locataire.user'])->loadCount('photos');

        $bail = $bien->bailActif;

        return response()->json($this->formater($bien) + [
            'photos' => $bien->photos->map(fn ($p) => [
                'id' => $p->id,
                'url' => $this->urlPublique($p->url),
                'ordre' => $p->ordre,
            ]),
            'bail_actif' => $bail ? [
                'id' => $bail->id,
                'numero' => $bail->numero,
                'date_debut' => $bail->date_debut?->toDateString(),
                'date_fin' => $bail->date_fin?->toDateString(),
                'loyer_mensuel' => $bail->loyer_mensuel,
                'locataire' => $bail->locataire?->user
                    ? $bail->locataire->user->prenom . ' ' . $bail->locataire->user->nom
                    : null,
            ] : null,
        ]);
    }

    /**
     * Modification des informations (le statut n'est pas modifiable ici).
     */
    public function update(Request $request, Bien $bien): JsonResponse
    {
        $donnees = $this->normaliser($request->validate($this->regles()));

        $bien->update($donnees);
        $this->journaliser($request, 'modification', $bien);

        return response()->json([
            'message' => 'Bien modifié avec succès.',
            'bien' => $this->formater($bien->fresh(['proprietaire.user', 'photos'])->loadCount('photos')),
        ]);
    }

    /**
     * Suppression définitive : seulement si le bien n'a jamais eu de bail.
     */
    public function destroy(Request $request, Bien $bien): JsonResponse
    {
        if ($bien->baux()->exists()) {
            return response()->json([
                'message' => 'Ce bien a un historique de baux : il ne peut pas être supprimé. Archivez-le plutôt.',
            ], 422);
        }

        DB::transaction(function () use ($bien, $request) {
            foreach ($bien->photos as $photo) {
                Storage::disk('public')->delete($photo->url);
            }
            $this->journaliser($request, 'suppression', $bien);
            $bien->delete(); // supprime aussi les photos en base (cascade)
        });

        return response()->json(['message' => 'Bien supprimé.']);
    }

    /**
     * Publier / retirer du site public.
     * PATCH /api/biens/{bien}/publication  { "publie": true }
     */
    public function publication(Request $request, Bien $bien): JsonResponse
    {
        $publie = $request->validate(['publie' => ['required', 'boolean']])['publie'];

        if ($publie) {
            if ($bien->statut !== Bien::STATUT_LIBRE) {
                return response()->json(['message' => 'Seul un bien libre peut être publié sur le site.'], 422);
            }
            if (! $bien->photos()->exists()) {
                return response()->json(['message' => 'Ajoutez au moins une photo avant de publier ce bien.'], 422);
            }
        }

        $bien->update(['publie' => $publie]);
        $this->journaliser($request, $publie ? 'publication' : 'depublication', $bien);

        return response()->json([
            'message' => $publie ? 'Bien publié sur le site.' : 'Bien retiré du site.',
            'bien' => $this->formater($bien->fresh(['proprietaire.user', 'photos'])->loadCount('photos')),
        ]);
    }

    /**
     * Archiver (bien retiré de la gestion) ou désarchiver.
     * PATCH /api/biens/{bien}/archivage  { "archive": true }
     */
    public function archivage(Request $request, Bien $bien): JsonResponse
    {
        $archive = $request->validate(['archive' => ['required', 'boolean']])['archive'];

        if ($archive && $bien->statut === Bien::STATUT_LOUE) {
            return response()->json(['message' => 'Un bien loué ne peut pas être archivé. Résiliez d’abord le bail.'], 422);
        }

        $bien->update([
            'statut' => $archive ? Bien::STATUT_ARCHIVE : Bien::STATUT_LIBRE,
            'publie' => false,
        ]);
        $this->journaliser($request, $archive ? 'archivage' : 'desarchivage', $bien);

        return response()->json([
            'message' => $archive ? 'Bien archivé.' : 'Bien réactivé (libre).',
            'bien' => $this->formater($bien->fresh(['proprietaire.user', 'photos'])->loadCount('photos')),
        ]);
    }

    // ----- Méthodes internes -----

    private function regles(): array
    {
        return [
            'proprietaire_id' => ['required', 'integer', 'exists:proprietaires,id'],
            'type' => ['required', Rule::in(self::TYPES)],
            'titre' => ['required', 'string', 'max:150'],
            'quartier' => ['required', 'string', 'max:100'],
            'adresse' => ['required', 'string', 'max:255'],
            'surface' => ['nullable', 'numeric', 'min:0'],
            'nb_pieces' => ['nullable', 'integer', 'min:0', 'max:100'],
            'loyer_propose' => ['required', 'numeric', 'min:0'],
            'caution' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:5000'],
            'taux_commission' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }

    /** Valeurs par défaut : la base n'accepte pas de vide pour la caution et la commission. */
    private function normaliser(array $donnees): array
    {
        $donnees['caution'] = $donnees['caution'] ?? 0;
        $donnees['taux_commission'] = $donnees['taux_commission']
            ?? ParametreAgence::value('taux_commission_defaut')
            ?? 10;

        return $donnees;
    }

    /** BIEN-2026-0001, BIEN-2026-0002… */
    private function nouvelleReference(): string
    {
        $suivant = (Bien::max('id') ?? 0) + 1;

        return sprintf('BIEN-%s-%04d', now()->format('Y'), $suivant);
    }

    /** Chemin stocké → adresse complète de l'image */
    private function urlPublique(string $chemin): string
    {
        return str_starts_with($chemin, 'http') ? $chemin : asset('storage/' . $chemin);
    }

    private function formater(Bien $b): array
    {
        $premiere = $b->photos->first();

        return [
            'id' => $b->id,
            'reference' => $b->reference,
            'type' => $b->type,
            'titre' => $b->titre,
            'quartier' => $b->quartier,
            'adresse' => $b->adresse,
            'surface' => $b->surface,
            'nb_pieces' => $b->nb_pieces,
            'loyer_propose' => $b->loyer_propose,
            'caution' => $b->caution,
            'description' => $b->description,
            'taux_commission' => $b->taux_commission,
            'statut' => $b->statut,
            'publie' => $b->publie,
            'proprietaire' => $b->proprietaire ? [
                'id' => $b->proprietaire->id,
                'nom' => $b->proprietaire->user->nom,
                'prenom' => $b->proprietaire->user->prenom,
            ] : null,
            'photo_principale' => $premiere ? $this->urlPublique($premiere->url) : null,
            'photos_count' => $b->photos_count ?? $b->photos->count(),
            'created_at' => $b->created_at,
        ];
    }

    private function journaliser(Request $request, string $action, Bien $b): void
    {
        JournalActivite::create([
            'user_id' => $request->user()->id,
            'action' => $action,
            'entite' => 'Bien',
            'entite_id' => $b->id,
            'date_heure' => now(),
        ]);
    }
}