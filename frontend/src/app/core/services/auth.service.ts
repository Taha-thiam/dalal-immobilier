import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginResponse, Role, User } from '../models/user.model';

const CLE_JETON = 'dalal_token';
const CLE_UTILISATEUR = 'dalal_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // Utilisateur connecté (signal : l'interface se met à jour automatiquement)
  private utilisateur = signal<User | null>(this.lireUtilisateurStocke());

  readonly user = this.utilisateur.asReadonly();
  readonly estConnecte = computed(() => this.utilisateur() !== null);

  /** Envoie email + mot de passe à Laravel et garde le jeton reçu. */
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/login`, { email, password })
      .pipe(tap((reponse) => this.enregistrerSession(reponse)));
  }

  /** Recharge le profil depuis l'API (vérifie que le jeton est toujours valide). */
  rafraichirProfil(): Observable<User> {
    return this.http
      .get<User>(`${environment.apiUrl}/me`)
      .pipe(tap((user) => this.mettreAJourUtilisateur(user)));
  }

  /** Déconnexion : prévient Laravel, puis nettoie la session même si l'API ne répond pas. */
  logout(): void {
    this.http.post(`${environment.apiUrl}/logout`, {}).subscribe({
      complete: () => this.terminerSession(),
      error: () => this.terminerSession(),
    });
  }

  /** Nettoie la session locale et renvoie vers la page de connexion. */
  terminerSession(): void {
    localStorage.removeItem(CLE_JETON);
    localStorage.removeItem(CLE_UTILISATEUR);
    this.utilisateur.set(null);
    this.router.navigate(['/connexion']);
  }

  getToken(): string | null {
    return localStorage.getItem(CLE_JETON);
  }

  aLeRole(...roles: Role[]): boolean {
    const user = this.utilisateur();
    return !!user && roles.includes(user.role);
  }

  /** Page d'accueil de chaque rôle après la connexion. */
  routeAccueil(): string {
    switch (this.utilisateur()?.role) {
      case 'administrateur': return '/admin';
      case 'gestionnaire':   return '/gestion';
      case 'comptable':      return '/comptabilite';
      case 'proprietaire':   return '/proprietaire';
      case 'locataire':      return '/locataire';
      default:               return '/connexion';
    }
  }

  // ----- Méthodes internes -----

  private enregistrerSession(reponse: LoginResponse): void {
    localStorage.setItem(CLE_JETON, reponse.token);
    this.mettreAJourUtilisateur(reponse.user);
  }

  private mettreAJourUtilisateur(user: User): void {
    localStorage.setItem(CLE_UTILISATEUR, JSON.stringify(user));
    this.utilisateur.set(user);
  }

  private lireUtilisateurStocke(): User | null {
    try {
      const brut = localStorage.getItem(CLE_UTILISATEUR);
      return brut ? (JSON.parse(brut) as User) : null;
    } catch {
      return null;
    }
  }
}