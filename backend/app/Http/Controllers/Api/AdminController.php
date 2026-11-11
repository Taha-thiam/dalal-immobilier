<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JournalActivite;
use App\Models\ParametreAgence;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminController extends Controller
{
    /** Les rôles « internes » : les clients (propriétaires, locataires) se gèrent ailleurs. */
    private const ROLES_PERSONNEL = ['administrateur', 'gestionnaire', 'comptable'];

    // =====================================================================
    // PERSONNEL
    // =====================================================================

    /** GET /admin/personnel */
    public function personnel(): JsonResponse
    {
        $comptes = User::whereIn('role', self::ROLES_PERSONNEL)
            ->orderByRaw("CASE role WHEN 'administrateur' THEN 0 WHEN 'gestionnaire' THEN 1 ELSE 2 END")
            ->orderBy('nom')
            ->get(['id', 'nom', 'prenom', 'email', 'telephone', 'role', 'statut', 'matricule', 'created_at']);

        return response()->json($comptes);
    }

    /** POST /admin/personnel */
    public function creerCompte(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'prenom' => ['required', 'string', 'max:80'],
            'nom' => ['required', 'string', 'max:80'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'telephone' => ['nullable', 'string', 'max:30'],
            'role' => ['required', Rule::in(self::ROLES_PERSONNEL)],
        ], ['email.unique' => 'Cette adresse e-mail est déjà utilisée.']);

        $motDePasse = $this->motDePasseTemporaire();

        $user = User::create($donnees + [
            'password' => Hash::make($motDePasse),
            'statut' => 'actif',
            'matricule' => $this->matricule($donnees['role']),
        ]);

        $this->journaliser($request, 'compte_cree', "Compte {$user->role} créé : {$user->prenom} {$user->nom}");

        return response()->json([
            'message' => "Compte créé pour {$user->prenom} {$user->nom}.",
            'utilisateur' => $user->only(['id', 'nom', 'prenom', 'email', 'role', 'statut', 'matricule']),
            'mot_de_passe_temporaire' => $motDePasse,
        ], 201);
    }

    /** PATCH /admin/personnel/{user}/statut : activer / désactiver */
    public function basculerStatut(Request $request, User $user): JsonResponse
    {
        $this->verifierPersonnel($user);

        if ($user->id === $request->user()->id) {
            throw ValidationException::withMessages(['statut' => 'Vous ne pouvez pas désactiver votre propre compte.']);
        }

        $nouveau = $user->statut === 'actif' ? 'desactive' : 'actif';
        $user->update(['statut' => $nouveau]);

        // Un compte désactivé est déconnecté immédiatement de tous ses appareils
        if ($nouveau === 'desactive') {
            $user->tokens()->delete();
        }

        $this->journaliser($request, 'compte_' . $nouveau, "Compte de {$user->prenom} {$user->nom} : {$nouveau}");

        return response()->json([
            'message' => $nouveau === 'actif'
                ? "Compte de {$user->prenom} réactivé."
                : "Compte de {$user->prenom} désactivé et déconnecté.",
        ]);
    }

    /** POST /admin/personnel/{user}/mot-de-passe : réinitialiser */
    public function reinitialiserMotDePasse(Request $request, User $user): JsonResponse
    {
        $this->verifierPersonnel($user);

        $motDePasse = $this->motDePasseTemporaire();
        $user->update(['password' => Hash::make($motDePasse)]);
        $user->tokens()->delete();

        $this->journaliser($request, 'mot_de_passe_reinitialise', "Mot de passe réinitialisé : {$user->prenom} {$user->nom}");

        return response()->json([
            'message' => "Nouveau mot de passe généré pour {$user->prenom}.",
            'mot_de_passe_temporaire' => $motDePasse,
        ]);
    }

    // =====================================================================
    // PARAMÈTRES DE L'AGENCE
    // =====================================================================

    /** Champs modifiables, s'ils existent dans la table. */
    private const PARAMETRES = [
        'nom' => ['nullable', 'string', 'max:150'],
        'adresse' => ['nullable', 'string', 'max:255'],
        'ville' => ['nullable', 'string', 'max:100'],
        'telephone' => ['nullable', 'string', 'max:30'],
        'email' => ['nullable', 'email', 'max:150'],
        'site_web' => ['nullable', 'string', 'max:150'],
        'ninea' => ['nullable', 'string', 'max:50'],
        'rccm' => ['nullable', 'string', 'max:50'],
        'taux_commission' => ['nullable', 'numeric', 'min:0', 'max:50'],
        'commission_defaut' => ['nullable', 'numeric', 'min:0', 'max:50'],
        'jour_echeance' => ['nullable', 'integer', 'min:1', 'max:28'],
        'penalite_retard' => ['nullable', 'numeric', 'min:0', 'max:100'],
    ];

    /** GET /admin/parametres */
    public function parametres(): JsonResponse
    {
        return response()->json(ParametreAgence::firstOrCreate([]));
    }

    /** PUT /admin/parametres */
    public function enregistrerParametres(Request $request): JsonResponse
    {
        $regles = collect(self::PARAMETRES)
            ->filter(fn($r, $col) => Schema::hasColumn('parametres_agence', $col))
            ->all();

        $donnees = $request->validate($regles);

        $parametres = ParametreAgence::firstOrCreate([]);
        $parametres->forceFill($donnees)->save();

        $this->journaliser($request, 'parametres_modifies', "Paramètres de l'agence modifiés");

        return response()->json(['message' => 'Paramètres enregistrés.', 'parametres' => $parametres->fresh()]);
    }

    // =====================================================================
    // JOURNAL D'ACTIVITÉ
    // =====================================================================

    /** GET /admin/journal */
    public function journal(Request $request): JsonResponse
    {
        $requete = JournalActivite::query()->latest('id');

        if ($texte = trim((string) $request->query('recherche', ''))) {
            $colonnes = array_filter(['action', 'description', 'details', 'objet'], fn($c) => Schema::hasColumn('journal_activites', $c));
            $requete->where(function ($q) use ($colonnes, $texte) {
                foreach ($colonnes as $c) {
                    $q->orWhere($c, 'ilike', "%{$texte}%");
                }
            });
        }

        $page = $requete->paginate(25);
        $noms = User::whereIn('id', collect($page->items())->pluck('user_id')->filter()->unique())
            ->get(['id', 'prenom', 'nom', 'role'])->keyBy('id');

        return response()->json($page->through(fn($j) => array_merge($j->toArray(), [
            'auteur' => isset($j->user_id, $noms[$j->user_id])
                ? ['nom' => trim($noms[$j->user_id]->prenom . ' ' . $noms[$j->user_id]->nom), 'role' => $noms[$j->user_id]->role]
                : null,
        ])));
    }

    // ---------------------------------------------------------------------

    private function verifierPersonnel(User $user): void
    {
        if (!in_array($user->role, self::ROLES_PERSONNEL, true)) {
            abort(403, 'Ce compte appartient à un client : il se gère depuis Propriétaires ou Locataires.');
        }
    }

    /** Ex. : Dalal-7K4P-2026 (facile à dicter au téléphone) */
    private function motDePasseTemporaire(): string
    {
        return 'Dalal-' . strtoupper(Str::random(4)) . '-' . now()->year;
    }

    /** ADM-001, GES-002, CPT-003… */
    private function matricule(string $role): string
    {
        $prefixe = ['administrateur' => 'ADM', 'gestionnaire' => 'GES', 'comptable' => 'CPT'][$role];
        $n = User::where('matricule', 'like', "{$prefixe}-%")->count() + 1;

        return sprintf('%s-%03d', $prefixe, $n);
    }

    /** Écrit dans le journal, sans jamais bloquer l'action si la table diffère. */
    private function journaliser(Request $request, string $action, string $description): void
    {
        try {
            $j = new JournalActivite();
            $champs = ['user_id' => $request->user()->id, 'action' => $action, 'description' => $description, 'ip' => $request->ip()];
            foreach ($champs as $col => $val) {
                if (Schema::hasColumn('journal_activites', $col)) {
                    $j->{$col} = $val;
                }
            }
            $j->save();
        } catch (\Throwable) {
            // Le journal ne doit jamais empêcher l'action principale
        }
    }
}