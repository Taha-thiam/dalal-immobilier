<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Autorise la requête seulement si l'utilisateur a l'un des rôles indiqués.
 * Exemple dans les routes : ->middleware('role:administrateur,gestionnaire')
 */
class VerifierRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! $user->estActif()) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }

        if (! $user->aLeRole(...$roles)) {
            return response()->json(['message' => 'Vous n\'avez pas les droits pour cette action.'], 403);
        }

        return $next($request);
    }
}
