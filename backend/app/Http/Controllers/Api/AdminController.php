<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DemandeMotDePasse;
use App\Models\JournalActivite;
use App\Models\ParametreAgence;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AdminController extends Controller
{
    /** Les rôles « internes » : les clients (propriétaires, locataires) se créent ailleurs. */
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
            'prenom'    => ['required', 'string', 'max:80'],
            'nom'       => ['required', 'string', 'max:80'],
            'email'     => ['required', 'email', 'max:150', 'unique:users,email'],
            'telephone' => ['nullable', 'string', 'max:30'],
            'role'      => ['required', Rule::in(self::ROLES_PERSONNEL)],
        ], ['email.unique' => 'Cette adresse e-mail est déjà utilisée.']);

        $user = User::create($donnees + [
            'password'  => User::MOT_DE_PASSE_DEFAUT,
            'statut'    => 'actif',
            'matricule' => $this->matricule($donnees['role']),
        ]);

        $this->journaliser($request, 'compte_cree', $user->id);

        return response()->json([
            'message'                 => "Compte créé pour {$user->prenom} {$user->nom}.",
            'utilisateur'             => $user->only(['id', 'nom', 'prenom', 'email', 'role', 'statut', 'matricule']),
            'mot_de_passe_temporaire' => User::MOT_DE_PASSE_DEFAUT,
        ], 201);
    }

    /** PATCH /admin/personnel/{user}/statut : activer / désactiver */
    public function basculerStatut(Request $request, User $user): JsonResponse
    {
        if (! in_array($user->role, self::ROLES_PERSONNEL, true)) {
            abort(403, 'Ce compte appartient à un client : il se gère depuis Propriétaires ou Locataires.');
        }
        if ($user->id === $request->user()->id) {
            throw ValidationException::withMessages(['statut' => 'Vous ne pouvez pas désactiver votre propre compte.']);
        }

        $nouveau = $user->statut === 'actif' ? 'desactive' : 'actif';
        $user->update(['statut' => $nouveau]);

        if ($nouveau === 'desactive') {
            $user->tokens()->delete(); // déconnecté immédiatement
        }

        $this->journaliser($request, 'compte_' . $nouveau, $user->id);

        return response()->json([
            'message' => $nouveau === 'actif'
                ? "Compte de {$user->prenom} réactivé."
                : "Compte de {$user->prenom} désactivé et déconnecté.",
        ]);
    }

    // =====================================================================
    // MOTS DE PASSE : seul l'administrateur réinitialise sans l'ancien
    // =====================================================================

    /** GET /admin/utilisateurs?recherche=… : TOUS les comptes (personnel et clients) */
    public function utilisateurs(Request $request): JsonResponse
    {
        $texte = trim((string) $request->query('recherche', ''));

        $page = User::query()
            ->when($texte !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('nom', 'ilike', "%{$texte}%")
                ->orWhere('prenom', 'ilike', "%{$texte}%")
                ->orWhere('email', 'ilike', "%{$texte}%")
                ->orWhere('telephone', 'ilike', "%{$texte}%")))
            ->orderBy('nom')
            ->paginate(15, ['id', 'nom', 'prenom', 'email', 'telephone', 'role', 'statut']);

        return response()->json($page);
    }

    /**
     * POST /admin/utilisateurs/{user}/mot-de-passe
     * Sans « nouveau » : remet le mot de passe par défaut. Avec : met celui choisi par l'admin.
     */
    public function reinitialiserMotDePasse(Request $request, User $user): JsonResponse
    {
        $donnees = $request->validate([
            'nouveau' => ['nullable', 'string', Password::min(6)],
        ]);

        $motDePasse = $donnees['nouveau'] ?? User::MOT_DE_PASSE_DEFAUT;

        $user->update(['password' => $motDePasse]);   // haché automatiquement
        $user->tokens()->delete();                     // déconnecté de partout

        // Ses demandes « mot de passe oublié » en attente sont traitées
        DemandeMotDePasse::where('user_id', $user->id)->where('statut', 'en_attente')->update([
            'statut' => 'traitee', 'traite_par' => $request->user()->id, 'traite_le' => now(),
        ]);

        $this->journaliser($request, 'mot_de_passe_reinitialise', $user->id);

        return response()->json([
            'message'                 => "Mot de passe de {$user->prenom} {$user->nom} réinitialisé.",
            'mot_de_passe_temporaire' => $motDePasse,
        ]);
    }

    /** GET /admin/demandes-mot-de-passe?statut=en_attente */
    public function demandesMotDePasse(Request $request): JsonResponse
    {
        $statut = $request->query('statut', 'en_attente');

        $page = DemandeMotDePasse::with(['user:id,nom,prenom,email,telephone,role,statut', 'traitePar:id,nom,prenom'])
            ->when($statut !== '', fn ($q) => $q->where('statut', $statut))
            ->latest('id')
            ->paginate(15);

        return response()->json($page);
    }

    /** GET /admin/demandes-mot-de-passe/compteur : pour la pastille rouge */
    public function compteurDemandesMotDePasse(): JsonResponse
    {
        return response()->json(['en_attente' => DemandeMotDePasse::where('statut', 'en_attente')->count()]);
    }

    /** PATCH /admin/demandes-mot-de-passe/{demande}/rejet : demande suspecte ou déjà réglée */
    public function rejeterDemande(Request $request, DemandeMotDePasse $demande): JsonResponse
    {
        if ($demande->statut !== 'en_attente') {
            throw ValidationException::withMessages(['statut' => 'Cette demande est déjà traitée.']);
        }

        $demande->update(['statut' => 'rejetee', 'traite_par' => $request->user()->id, 'traite_le' => now()]);

        return response()->json(['message' => 'Demande rejetée.']);
    }

    // =====================================================================
    // PARAMÈTRES DE L'AGENCE
    // =====================================================================

    private const PARAMETRES = [
        'nom'               => ['nullable', 'string', 'max:150'],
        'adresse'           => ['nullable', 'string', 'max:255'],
        'ville'             => ['nullable', 'string', 'max:100'],
        'telephone'         => ['nullable', 'string', 'max:30'],
        'email'             => ['nullable', 'email', 'max:150'],
        'site_web'          => ['nullable', 'string', 'max:150'],
        'ninea'             => ['nullable', 'string', 'max:50'],
        'rccm'              => ['nullable', 'string', 'max:50'],
        'taux_commission'   => ['nullable', 'numeric', 'min:0', 'max:50'],
        'commission_defaut' => ['nullable', 'numeric', 'min:0', 'max:50'],
        'jour_echeance'     => ['nullable', 'integer', 'min:1', 'max:28'],
        'penalite_retard'   => ['nullable', 'numeric', 'min:0', 'max:100'],
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
            ->filter(fn ($r, $col) => Schema::hasColumn('parametres_agence', $col))
            ->all();

        $donnees = $request->validate($regles);

        $parametres = ParametreAgence::firstOrCreate([]);
        $parametres->forceFill($donnees)->save();

        $this->journaliser($request, 'parametres_modifies', $parametres->id);

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
            $colonnes = array_filter(['action', 'entite', 'description'], fn ($c) => Schema::hasColumn('journal_activites', $c));
            $requete->where(function ($q) use ($colonnes, $texte) {
                foreach ($colonnes as $c) {
                    $q->orWhere($c, 'ilike', "%{$texte}%");
                }
            });
        }

        $page = $requete->paginate(25);
        $noms = User::whereIn('id', collect($page->items())->pluck('user_id')->filter()->unique())
            ->get(['id', 'prenom', 'nom', 'role'])->keyBy('id');

        return response()->json($page->through(fn ($j) => array_merge($j->toArray(), [
            'description' => $j->description ?? trim(str_replace('_', ' ', (string) $j->action) . ' ' . ($j->entite ?? '') . ($j->entite_id ? " n°{$j->entite_id}" : '')),
            'auteur' => isset($j->user_id, $noms[$j->user_id])
                ? ['nom' => trim($noms[$j->user_id]->prenom . ' ' . $noms[$j->user_id]->nom), 'role' => $noms[$j->user_id]->role]
                : null,
        ])));
    }

    // ---------------------------------------------------------------------

    /** ADM-001, GES-002, CPT-003… */
    private function matricule(string $role): string
    {
        $prefixe = ['administrateur' => 'ADM', 'gestionnaire' => 'GES', 'comptable' => 'CPT'][$role];
        $n = User::where('matricule', 'like', "{$prefixe}-%")->count() + 1;

        return sprintf('%s-%03d', $prefixe, $n);
    }

    /** Écrit dans le journal (colonnes de ta table), sans jamais bloquer l'action. */
    private function journaliser(Request $request, string $action, ?int $entiteId = null): void
    {
        try {
            JournalActivite::create([
                'user_id'    => $request->user()->id,
                'action'     => $action,
                'entite'     => 'User',
                'entite_id'  => $entiteId,
                'date_heure' => now(),
            ]);
        } catch (\Throwable) {
        }
    }
}