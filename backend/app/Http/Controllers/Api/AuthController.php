<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DemandeMotDePasse;
use App\Models\JournalActivite;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Connexion : vérifie l'email et le mot de passe, puis renvoie un jeton Sanctum.
     */
    public function login(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $donnees['email'])->first();

        if (!$user || !Hash::check($donnees['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Email ou mot de passe incorrect.'],
            ]);
        }

        if (!$user->estActif()) {
            return response()->json([
                'message' => 'Votre compte est désactivé. Contactez l\'administrateur.',
            ], 403);
        }

        $jeton = $user->createToken('dalal-angular')->plainTextToken;

        $this->journaliser($user->id, 'connexion', $user->id);

        return response()->json([
            'token' => $jeton,
            'user' => $this->profil($user),
        ]);
    }

    /**
     * Renvoie l'utilisateur connecté (utilisé par Angular au rechargement de la page).
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json($this->profil($request->user()));
    }

    /**
     * Déconnexion : supprime le jeton utilisé pour cette requête.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnexion réussie.']);
    }

    /**
     * PUT /mot-de-passe : chaque utilisateur change SON mot de passe (l'ancien est exigé).
     */
    public function changerMotDePasse(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'mot_de_passe_actuel' => ['required', 'string'],
            'nouveau' => ['required', 'confirmed', 'different:mot_de_passe_actuel', Password::min(6)->letters()->numbers()],
        ], [
            'mot_de_passe_actuel.required' => 'Saisissez votre mot de passe actuel.',
            'nouveau.required' => 'Saisissez le nouveau mot de passe.',
            'nouveau.confirmed' => 'Les deux nouveaux mots de passe ne sont pas identiques.',
            'nouveau.different' => "Le nouveau mot de passe doit être différent de l'ancien.",
        ]);

        if (!Hash::check($request->input('mot_de_passe_actuel'), $user->password)) {
            throw ValidationException::withMessages([
                'mot_de_passe_actuel' => 'Le mot de passe actuel est incorrect.',
            ]);
        }

        if ($request->input('nouveau') === User::MOT_DE_PASSE_DEFAUT) {
            throw ValidationException::withMessages([
                'nouveau' => 'Choisissez un mot de passe personnel, différent du mot de passe par défaut.',
            ]);
        }

        $user->update(['password' => $request->input('nouveau')]); // haché automatiquement (cast « hashed »)

        // Les autres appareils sont déconnectés ; celui-ci reste connecté
        $actuel = $user->currentAccessToken()->id;
        $user->tokens()->where('id', '!=', $actuel)->delete();

        $this->journaliser($user->id, 'mot_de_passe_modifie', $user->id);

        return response()->json([
            'message' => 'Mot de passe modifié. Vos autres appareils ont été déconnectés.',
            'user' => $this->profil($user->fresh()),
        ]);
    }

    /**
     * POST /mot-de-passe-oublie (public) : crée une demande que l'administrateur traitera.
     * Même réponse que l'email existe ou non : on ne révèle pas qui a un compte.
     */
    public function motDePasseOublie(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'email' => ['required', 'email', 'max:150'],
        ], ['email.email' => 'Adresse e-mail invalide.']);

        $user = User::where('email', $donnees['email'])->first();

        if ($user) {
            $dejaEnAttente = DemandeMotDePasse::where('user_id', $user->id)
                ->where('statut', 'en_attente')
                ->exists();

            if (!$dejaEnAttente) {
                DemandeMotDePasse::create([
                    'email' => $user->email,
                    'user_id' => $user->id,
                    'statut' => 'en_attente',
                    'ip' => $request->ip(),
                ]);
            }
        }

        return response()->json([
            'message' => "Votre demande a été transmise à l'administrateur. "
                . 'Il réinitialisera votre mot de passe et vous contactera.',
        ]);
    }

    // ----- Méthodes internes -----

    private function profil(User $user): array
    {
        return [
            'id' => $user->id,
            'nom' => $user->nom,
            'prenom' => $user->prenom,
            'email' => $user->email,
            'telephone' => $user->telephone,
            'role' => $user->role,
            // true tant que l'utilisateur garde « passer » : Angular affichera un rappel
            'mot_de_passe_par_defaut' => Hash::check(User::MOT_DE_PASSE_DEFAUT, $user->password),
        ];
    }

    private function journaliser(int $userId, string $action, int $entiteId): void
    {
        try {
            JournalActivite::create([
                'user_id' => $userId,
                'action' => $action,
                'entite' => 'User',
                'entite_id' => $entiteId,
                'date_heure' => now(),
            ]);
        } catch (\Throwable) {
            // Le journal ne doit jamais bloquer la connexion
        }
    }
}