<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bien;
use App\Models\DemandeLocation;
use App\Models\MessageContact;
use App\Models\ParametreAgence;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class PortailController extends Controller
{
    /** Colonnes privées : jamais envoyées au public. */
    private const PRIVEES = [
        'proprietaire_id',
        'taux_commission',
        'commission',
        'adresse',
        'adresse_complete',
        'notes',
        'note_interne',
        'cree_par',
        'created_by',
        'updated_by',
        'deleted_at',
    ];

    /** Trouve le vrai nom d'une colonne parmi plusieurs possibles. */
    private function colonne(array $candidats): ?string
    {
        foreach ($candidats as $c) {
            if (Schema::hasColumn('biens', $c))
                return $c;
        }
        return null;
    }

    // =====================================================================
    // GET /public/annonces : la vitrine, avec filtres
    // =====================================================================
    public function annonces(Request $request): JsonResponse
    {
        $colLoyer = $this->colonne(['loyer_mensuel', 'loyer', 'prix']);
        $colType = $this->colonne(['type', 'type_bien', 'categorie']);
        $colPieces = $this->colonne(['nombre_pieces', 'nb_pieces', 'pieces']);

        $requete = Bien::publics()->with('photos')->latest('id');

        if ($texte = trim((string) $request->query('recherche', ''))) {
            $motif = "%{$texte}%";
            $requete->where(fn($q) => $q->where('titre', 'ilike', $motif)->orWhere('quartier', 'ilike', $motif));
        }
        if ($quartier = $request->query('quartier')) {
            $requete->where('quartier', 'ilike', $quartier);
        }
        if ($colType && ($type = $request->query('type'))) {
            $requete->where($colType, $type);
        }
        if ($colLoyer && is_numeric($request->query('prix_max'))) {
            $requete->where($colLoyer, '<=', (float) $request->query('prix_max'));
        }
        if ($colPieces && is_numeric($request->query('pieces_min'))) {
            $requete->where($colPieces, '>=', (int) $request->query('pieces_min'));
        }

        return response()->json(
            $requete->paginate(12)->through(fn(Bien $b) => $this->format($b))
        );
    }

    /** GET /public/annonces/{id} */
    public function annonce(int $id): JsonResponse
    {
        $bien = Bien::publics()->with('photos')->findOrFail($id);

        return response()->json($this->format($bien, detail: true));
    }

    /** GET /public/filtres : quartiers et types existants, pour les listes déroulantes */
    public function filtres(): JsonResponse
    {
        $colType = $this->colonne(['type', 'type_bien', 'categorie']);

        return response()->json([
            'quartiers' => Bien::publics()->whereNotNull('quartier')->distinct()->orderBy('quartier')->pluck('quartier'),
            'types' => $colType ? Bien::publics()->whereNotNull($colType)->distinct()->orderBy($colType)->pluck($colType) : [],
        ]);
    }

    /** GET /public/agence : coordonnées affichées dans le pied de page */
    public function agence(): JsonResponse
    {
        $a = ParametreAgence::first();

        return response()->json([
            'nom' => $a->nom ?? 'Dalal Immobilier',
            'slogan' => 'Ici, vous êtes chez vous',
            'adresse' => $a->adresse ?? 'Sacré-Cœur 3, Dakar',
            'telephone' => $a->telephone ?? null,
            'email' => $a->email ?? null,
        ]);
    }

    // =====================================================================
    // POST /public/annonces/{id}/demandes : « Je suis intéressé(e) »
    // =====================================================================
    public function demander(Request $request, int $id): JsonResponse
    {
        $bien = Bien::publics()->findOrFail($id);

        $donnees = $request->validate([
            'prenom' => ['required', 'string', 'max:80'],
            'nom' => ['required', 'string', 'max:80'],
            'telephone' => ['required', 'string', 'min:9', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'profession' => ['nullable', 'string', 'max:100'],
            'date_entree_souhaitee' => ['nullable', 'date', 'after_or_equal:today'],
            'message' => ['nullable', 'string', 'max:2000'],
            'site_web' => ['nullable', 'max:0'], // piège à robots : champ invisible, doit rester vide
        ], [
            'telephone.min' => 'Numéro de téléphone trop court.',
            'date_entree_souhaitee.after_or_equal' => "La date d'entrée ne peut pas être dans le passé.",
            'site_web.max' => 'Envoi refusé.',
        ]);

        // Anti-doublon : même téléphone, même bien, dans les dernières 24 h
        $doublon = DemandeLocation::where('bien_id', $bien->id)
            ->where('telephone', $donnees['telephone'])
            ->where('created_at', '>=', now()->subDay())
            ->exists();

        if ($doublon) {
            return response()->json([
                'message' => 'Votre demande pour ce logement a déjà été reçue. Nous vous rappelons très vite.',
            ]);
        }

        unset($donnees['site_web']);

        $demande = DemandeLocation::create($donnees + [
            'numero' => $this->nouveauNumero(),
            'bien_id' => $bien->id,
            'statut' => DemandeLocation::NOUVELLE,
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'message' => "Merci {$demande->prenom} ! Votre demande {$demande->numero} est bien reçue. "
                . 'Un conseiller Dalal Immobilier vous appelle sous 48 h.',
        ], 201);
    }

    // =====================================================================
    // POST /public/contact : « Nous contacter »
    // =====================================================================
    public function contacter(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'nom' => ['required', 'string', 'max:120'],
            'email' => ['required_without:telephone', 'nullable', 'email', 'max:150'],
            'telephone' => ['required_without:email', 'nullable', 'string', 'max:30'],
            'sujet' => ['nullable', 'string', 'max:150'],
            'message' => ['required', 'string', 'min:10', 'max:3000'],
            'site_web' => ['nullable', 'max:0'],
        ], [
            'email.required_without' => 'Indiquez au moins un e-mail ou un téléphone.',
            'telephone.required_without' => 'Indiquez au moins un e-mail ou un téléphone.',
            'message.min' => 'Votre message est un peu court (10 caractères minimum).',
        ]);

        unset($donnees['site_web']);
        MessageContact::create($donnees + ['lu' => false, 'ip' => $request->ip()]);

        return response()->json(['message' => 'Message envoyé. Merci, nous vous répondons rapidement.'], 201);
    }

    // ---------------------------------------------------------------------

    /** Version « vitrine » d'un bien : champs utiles + photos en URL, rien de privé. */
    private function format(Bien $b, bool $detail = false): array
    {
        $donnees = collect($b->toArray())->except(array_merge(self::PRIVEES, ['photos']))->all();

        $photos = $b->photos->map(fn($p) => [
            'id' => $p->id,
            'url' => $this->urlPhoto($p),
            'principale' => (bool) ($p->est_principale ?? $p->principale ?? false),
        ])->values();

        $principale = $photos->firstWhere('principale', true) ?? $photos->first();

        return array_merge($donnees, [
            // Champs normalisés : le front les lit sans se soucier des noms de colonnes
            'loyer' => (float) ($b->loyer_mensuel ?? $b->loyer ?? $b->prix ?? 0),
            'type_bien' => $b->type ?? $b->type_bien ?? $b->categorie ?? null,
            'pieces' => $b->nombre_pieces ?? $b->nb_pieces ?? $b->pieces ?? null,
            'surface' => $b->superficie ?? $b->surface ?? null,
            'photo_principale' => $principale['url'] ?? null,
            'photos' => $detail ? $photos : $photos->take(4),
        ]);
    }

    private function urlPhoto($photo): ?string
    {
        if (!empty($photo->url) && str_starts_with($photo->url, 'http')) {
            return $photo->url;
        }
        $chemin = $photo->chemin ?? $photo->path ?? $photo->fichier ?? $photo->url ?? null;

        return $chemin ? Storage::disk('public')->url($chemin) : null;
    }

    /** DEM-2026-0001, DEM-2026-0002… */
    private function nouveauNumero(): string
    {
        $annee = now()->year;
        $dernier = DemandeLocation::where('numero', 'like', "DEM-{$annee}-%")->orderByDesc('numero')->value('numero');
        $suivant = $dernier ? ((int) substr($dernier, -4)) + 1 : 1;

        return sprintf('DEM-%d-%04d', $annee, $suivant);
    }
}