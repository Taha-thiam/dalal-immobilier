import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/user.model';

/**
 * Page réservée aux utilisateurs connectés.
 * Pas connecté → redirection vers /connexion.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.estConnecte() ? true : router.createUrlTree(['/connexion']);
};

/**
 * Page réservée à certains rôles, lus dans la route : data: { roles: ['gestionnaire'] }
 * Mauvais rôle → retour vers la page d'accueil de son propre rôle.
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = (route.data?.['roles'] ?? []) as Role[];

  if (!auth.estConnecte()) {
    return router.createUrlTree(['/connexion']);
  }
  return auth.aLeRole(...roles) ? true : router.createUrlTree([auth.routeAccueil()]);
};

/**
 * Page de connexion : inutile si on est déjà connecté.
 * Déjà connecté → redirection vers son espace.
 */
export const invitesGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.estConnecte() ? router.createUrlTree([auth.routeAccueil()]) : true;
};