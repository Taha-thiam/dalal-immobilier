<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JournalActivite;
use App\Models\Proprietaire;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProprietaireController extends Controller
{
    /**
     * Liste paginée, avec recherche (nom, prénom, email, téléphone).
     * GET /api/proprietaires?recherche=diop&page=1
     */
    public function index(Request $request): JsonResponse
    {
        $recherche = trim((string) $request->query('recherche', ''));

        $proprietaires = Proprietaire::with('user')
            ->withCount('biens')
            ->when($recherche !== '', function ($requete) use ($recherche) {
                $requete->whereHas('user', function ($u) use ($recherche) {
                    $u->where('nom', 'ilike', "%{$recherche}%")
                      ->orWhere('prenom', 'ilike', "%{$recherche}%")
                      ->orWhere('email', 'ilike', "%{$recherche}%")
                      ->orWhere('telephone', 'ilike', "%{$recherche}%");
                });
            })
            ->latest()
            ->paginate(10);

        $proprietaires->getCollection()->transform(fn ($p) => $this->formater($p));

        return response()->json($proprietaires);
    }

    /**
     * Création : compte utilisateur + fiche propriétaire, dans une seule transaction.
     */
    public function store(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'nom' => ['required', 'string', 'max:100'],
            'prenom' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'telephone' => ['nullable', 'string', 'max:30'],
            'adresse' => ['nullable', 'string', 'max:255'],
            'numero_cni' => ['nullable', 'string', 'max:50', 'unique:proprietaires,numero_cni'],
            'rib_reversement' => ['nullable', 'string', 'max:100'],
        ]);

        // Mot de passe par défaut, identique pour tous : à changer à la première connexion
        $motDePasse = User::MOT_DE_PASSE_DEFAUT;

        $proprietaire = DB::transaction(function () use ($donnees, $motDePasse, $request) {
            $user = User::create([
                'nom' => $donnees['nom'],
                'prenom' => $donnees['prenom'],
                'email' => $donnees['email'],
                'telephone' => $donnees['telephone'] ?? null,
                'role' => User::ROLE_PROPRIETAIRE,
                'statut' => 'actif',
                'password' => $motDePasse,
            ]);

            $proprietaire = $user->proprietaire()->create([
                'adresse' => $donnees['adresse'] ?? null,
                'numero_cni' => $donnees['numero_cni'] ?? null,
                'rib_reversement' => $donnees['rib_reversement'] ?? null,
            ]);

            $this->journaliser($request, 'creation', $proprietaire);

            return $proprietaire;
        });

        return response()->json([
            'message' => 'Propriétaire créé avec succès.',
            'proprietaire' => $this->formater($proprietaire->load('user')->loadCount('biens')),
            // Affiché au gestionnaire pour qu'il le communique au propriétaire
            'mot_de_passe_temporaire' => $motDePasse,
        ], 201);
    }

    /**
     * Détail d'un propriétaire, avec ses biens.
     */
    public function show(Proprietaire $proprietaire): JsonResponse
    {
        $proprietaire->load(['user', 'biens'])->loadCount('biens');

        return response()->json($this->formater($proprietaire) + [
            'biens' => $proprietaire->biens,
        ]);
    }

    /**
     * Modification du compte et de la fiche.
     */
    public function update(Request $request, Proprietaire $proprietaire): JsonResponse
    {
        $donnees = $request->validate([
            'nom' => ['required', 'string', 'max:100'],
            'prenom' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', Rule::unique('users', 'email')->ignore($proprietaire->user_id)],
            'telephone' => ['nullable', 'string', 'max:30'],
            'adresse' => ['nullable', 'string', 'max:255'],
            'numero_cni' => ['nullable', 'string', 'max:50', Rule::unique('proprietaires', 'numero_cni')->ignore($proprietaire->id)],
            'rib_reversement' => ['nullable', 'string', 'max:100'],
        ]);

        DB::transaction(function () use ($donnees, $proprietaire, $request) {
            $proprietaire->user->update([
                'nom' => $donnees['nom'],
                'prenom' => $donnees['prenom'],
                'email' => $donnees['email'],
                'telephone' => $donnees['telephone'] ?? null,
            ]);

            $proprietaire->update([
                'adresse' => $donnees['adresse'] ?? null,
                'numero_cni' => $donnees['numero_cni'] ?? null,
                'rib_reversement' => $donnees['rib_reversement'] ?? null,
            ]);

            $this->journaliser($request, 'modification', $proprietaire);
        });

        return response()->json([
            'message' => 'Propriétaire modifié avec succès.',
            'proprietaire' => $this->formater($proprietaire->fresh('user')->loadCount('biens')),
        ]);
    }

    /**
     * Suppression : refusée si le propriétaire a encore des biens.
     */
    public function destroy(Request $request, Proprietaire $proprietaire): JsonResponse
    {
        if ($proprietaire->biens()->exists()) {
            return response()->json([
                'message' => 'Impossible de supprimer ce propriétaire : il possède encore des biens. Archivez-les ou transférez-les d’abord.',
            ], 422);
        }

        DB::transaction(function () use ($proprietaire, $request) {
            $this->journaliser($request, 'suppression', $proprietaire);
            $proprietaire->user->delete(); // supprime aussi la fiche (cascade)
        });

        return response()->json(['message' => 'Propriétaire supprimé.']);
    }

    // ----- Méthodes internes -----

    /** Format unique renvoyé à Angular : compte + fiche à plat. */
    private function formater(Proprietaire $p): array
    {
        return [
            'id' => $p->id,
            'user_id' => $p->user_id,
            'nom' => $p->user->nom,
            'prenom' => $p->user->prenom,
            'email' => $p->user->email,
            'telephone' => $p->user->telephone,
            'statut' => $p->user->statut,
            'adresse' => $p->adresse,
            'numero_cni' => $p->numero_cni,
            'rib_reversement' => $p->rib_reversement,
            'biens_count' => $p->biens_count ?? 0,
            'created_at' => $p->created_at,
        ];
    }

    private function journaliser(Request $request, string $action, Proprietaire $p): void
    {
        JournalActivite::create([
            'user_id' => $request->user()->id,
            'action' => $action,
            'entite' => 'Proprietaire',
            'entite_id' => $p->id,
            'date_heure' => now(),
        ]);
    }
}