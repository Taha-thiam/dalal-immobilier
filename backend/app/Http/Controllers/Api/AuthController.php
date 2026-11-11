<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JournalActivite;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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

        if (! $user || ! Hash::check($donnees['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Email ou mot de passe incorrect.'],
            ]);
        }

        if (! $user->estActif()) {
            return response()->json([
                'message' => 'Votre compte est désactivé. Contactez l\'administrateur.',
            ], 403);
        }

        $jeton = $user->createToken('dalal-angular')->plainTextToken;

        JournalActivite::create([
            'user_id' => $user->id,
            'action' => 'connexion',
            'entite' => 'User',
            'entite_id' => $user->id,
            'date_heure' => now(),
        ]);

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

    private function profil(User $user): array
    {
        return [
            'id' => $user->id,
            'nom' => $user->nom,
            'prenom' => $user->prenom,
            'email' => $user->email,
            'telephone' => $user->telephone,
            'role' => $user->role,
        ];
    }
}
