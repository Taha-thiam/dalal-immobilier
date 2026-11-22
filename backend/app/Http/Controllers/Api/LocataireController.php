<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JournalActivite;
use App\Models\Locataire;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class LocataireController extends Controller
{
    /**
     * Liste paginée, avec recherche et nombre de baux.
     * GET /api/locataires?recherche=fall&page=1
     */
    public function index(Request $request): JsonResponse
    {
        $recherche = trim((string) $request->query('recherche', ''));

        $locataires = Locataire::with('user')
            ->withCount([
                'baux',
                'baux as baux_actifs_count' => fn($q) => $q->where('statut', 'actif'),
            ])
            ->when($recherche !== '', function ($requete) use ($recherche) {
                $requete->where(function ($w) use ($recherche) {
                    $w->where('numero_cni', 'ilike', "%{$recherche}%")
                        ->orWhereHas('user', function ($u) use ($recherche) {
                            $u->where('nom', 'ilike', "%{$recherche}%")
                                ->orWhere('prenom', 'ilike', "%{$recherche}%")
                                ->orWhere('email', 'ilike', "%{$recherche}%")
                                ->orWhere('telephone', 'ilike', "%{$recherche}%");
                        });
                });
            })
            ->latest()
            ->paginate(10);

        $locataires->getCollection()->transform(fn($l) => $this->formater($l));

        return response()->json($locataires);
    }

    /**
     * Création : compte utilisateur + fiche locataire, dans une seule transaction.
     */
    public function store(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'nom' => ['required', 'string', 'max:100'],
            'prenom' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'telephone' => ['nullable', 'string', 'max:30'],
            'numero_cni' => ['nullable', 'string', 'max:50', 'unique:locataires,numero_cni'],
            'profession' => ['nullable', 'string', 'max:100'],
        ]);

        // Mot de passe par défaut, identique pour tous : à changer à la première connexion
        $motDePasse = User::MOT_DE_PASSE_DEFAUT;

        $locataire = DB::transaction(function () use ($donnees, $motDePasse, $request) {
            $user = User::create([
                'nom' => $donnees['nom'],
                'prenom' => $donnees['prenom'],
                'email' => $donnees['email'],
                'telephone' => $donnees['telephone'] ?? null,
                'role' => User::ROLE_LOCATAIRE,
                'statut' => 'actif',
                'password' => $motDePasse,
            ]);

            $locataire = $user->locataire()->create([
                'numero_cni' => $donnees['numero_cni'] ?? null,
                'profession' => $donnees['profession'] ?? null,
            ]);

            $this->journaliser($request, 'creation', $locataire);

            return $locataire;
        });

        return response()->json([
            'message' => 'Locataire créé avec succès.',
            'locataire' => $this->formater($this->recharger($locataire)),
            // Affiché au gestionnaire pour qu'il le communique au locataire
            'mot_de_passe_temporaire' => $motDePasse,
        ], 201);
    }

    /**
     * Détail d'un locataire, avec l'historique de ses baux.
     */
    public function show(Locataire $locataire): JsonResponse
    {
        $locataire = $this->recharger($locataire);
        $locataire->load(['baux' => fn($q) => $q->with('bien')->latest('date_debut')]);

        return response()->json($this->formater($locataire) + [
            'baux' => $locataire->baux->map(fn($b) => [
                'id' => $b->id,
                'numero' => $b->numero,
                'statut' => $b->statut,
                'date_debut' => $b->date_debut?->toDateString(),
                'date_fin' => $b->date_fin?->toDateString(),
                'loyer_mensuel' => $b->loyer_mensuel,
                'bien' => $b->bien ? [
                    'id' => $b->bien->id,
                    'reference' => $b->bien->reference,
                    'titre' => $b->bien->titre,
                    'quartier' => $b->bien->quartier,
                ] : null,
            ]),
        ]);
    }

    /**
     * Modification du compte et de la fiche.
     */
    public function update(Request $request, Locataire $locataire): JsonResponse
    {
        $donnees = $request->validate([
            'nom' => ['required', 'string', 'max:100'],
            'prenom' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', Rule::unique('users', 'email')->ignore($locataire->user_id)],
            'telephone' => ['nullable', 'string', 'max:30'],
            'numero_cni' => ['nullable', 'string', 'max:50', Rule::unique('locataires', 'numero_cni')->ignore($locataire->id)],
            'profession' => ['nullable', 'string', 'max:100'],
        ]);

        DB::transaction(function () use ($donnees, $locataire, $request) {
            $locataire->user->update([
                'nom' => $donnees['nom'],
                'prenom' => $donnees['prenom'],
                'email' => $donnees['email'],
                'telephone' => $donnees['telephone'] ?? null,
            ]);

            $locataire->update([
                'numero_cni' => $donnees['numero_cni'] ?? null,
                'profession' => $donnees['profession'] ?? null,
            ]);

            $this->journaliser($request, 'modification', $locataire);
        });

        return response()->json([
            'message' => 'Locataire modifié avec succès.',
            'locataire' => $this->formater($this->recharger($locataire)),
        ]);
    }

    /**
     * Suppression : refusée si le locataire a déjà eu un bail.
     */
    public function destroy(Request $request, Locataire $locataire): JsonResponse
    {
        if ($locataire->baux()->exists()) {
            return response()->json([
                'message' => 'Ce locataire a un historique de baux : il ne peut pas être supprimé (ses paiements et quittances y sont rattachés).',
            ], 422);
        }

        DB::transaction(function () use ($locataire, $request) {
            $this->journaliser($request, 'suppression', $locataire);
            $locataire->user->delete(); // supprime aussi la fiche (cascade)
        });

        return response()->json(['message' => 'Locataire supprimé.']);
    }

    // ----- Méthodes internes -----

    /** Recharge le compte et les compteurs de baux */
    private function recharger(Locataire $l): Locataire
    {
        return $l->fresh('user')->loadCount([
            'baux',
            'baux as baux_actifs_count' => fn($q) => $q->where('statut', 'actif'),
        ]);
    }

    /** Format unique renvoyé à Angular : compte + fiche à plat. */
    private function formater(Locataire $l): array
    {
        return [
            'id' => $l->id,
            'user_id' => $l->user_id,
            'nom' => $l->user->nom,
            'prenom' => $l->user->prenom,
            'email' => $l->user->email,
            'telephone' => $l->user->telephone,
            'statut' => $l->user->statut,
            'numero_cni' => $l->numero_cni,
            'profession' => $l->profession,
            'baux_count' => $l->baux_count ?? 0,
            'baux_actifs_count' => $l->baux_actifs_count ?? 0,
            'created_at' => $l->created_at,
        ];
    }

    private function journaliser(Request $request, string $action, Locataire $l): void
    {
        JournalActivite::create([
            'user_id' => $request->user()->id,
            'action' => $action,
            'entite' => 'Locataire',
            'entite_id' => $l->id,
            'date_heure' => now(),
        ]);
    }
}