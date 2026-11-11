import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Passe sur CHAQUE requête envoyée à Laravel :
 * 1. ajoute « Accept: application/json » (sinon Laravel renvoie du HTML en cas d'erreur) ;
 * 2. ajoute le jeton « Authorization: Bearer … » si l'utilisateur est connecté ;
 * 3. si Laravel répond 401 (jeton expiré ou supprimé), déconnecte l'utilisateur.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const jeton = auth.getToken();

  let entetes = req.headers.set('Accept', 'application/json');
  if (jeton) {
    entetes = entetes.set('Authorization', `Bearer ${jeton}`);
  }

  return next(req.clone({ headers: entetes })).pipe(
    catchError((erreur: HttpErrorResponse) => {
      const estConnexion = req.url.endsWith('/login');
      if (erreur.status === 401 && !estConnexion) {
        auth.terminerSession();
      }
      return throwError(() => erreur);
    }),
  );
};