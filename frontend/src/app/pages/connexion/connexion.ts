import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-connexion',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
  <div class="relative min-h-screen overflow-hidden bg-noir-950 grid place-items-center px-4">

    <!-- Halos lumineux -->
    <div class="pointer-events-none absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-neon-bleu/15 blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-neon-rouge/15 blur-3xl"></div>

    <div class="relative w-full max-w-md">

      <!-- Logo -->
      <div class="mb-8 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.35em] text-neon-rouge text-glow-rouge animate-neon">
          Gestion immobilière
        </p>
        <h1 class="mt-2 text-4xl font-extrabold text-white">
          Dalal <span class="text-neon-bleu text-glow-bleu">Immobilier</span>
        </h1>
      </div>

      <!-- Carte du formulaire -->
      <form [formGroup]="formulaire" (ngSubmit)="seConnecter()"
            class="rounded-2xl border border-noir-600 bg-noir-800/80 p-8 backdrop-blur shadow-2xl">

        <h2 class="text-xl font-bold text-white">Connexion</h2>
        <p class="mt-1 text-sm text-slate-400">Accédez à votre espace personnel.</p>

        <!-- Message d'erreur -->
        @if (erreur()) {
          <div class="mt-5 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">
            {{ erreur() }}
          </div>
        }

        <!-- Email -->
        <label class="mt-6 block text-sm font-medium text-slate-300" for="email">Adresse email</label>
        <input id="email" type="email" formControlName="email" autocomplete="email"
               placeholder="exemple@dalal.test"
               class="mt-2 w-full rounded-xl border border-noir-600 bg-noir-900 px-4 py-3 text-white
                      placeholder:text-slate-500 outline-none transition
                      focus:border-neon-bleu focus:glow-bleu" />
        @if (champInvalide('email')) {
          <p class="mt-1 text-xs text-neon-rouge">Saisissez une adresse email valide.</p>
        }

        <!-- Mot de passe -->
        <label class="mt-5 block text-sm font-medium text-slate-300" for="password">Mot de passe</label>
        <div class="relative mt-2">
          <input id="password" [type]="afficherMotDePasse() ? 'text' : 'password'"
                 formControlName="password" autocomplete="current-password" placeholder="••••••••"
                 class="w-full rounded-xl border border-noir-600 bg-noir-900 px-4 py-3 pr-20 text-white
                        placeholder:text-slate-500 outline-none transition
                        focus:border-neon-bleu focus:glow-bleu" />
          <button type="button" (click)="afficherMotDePasse.set(!afficherMotDePasse())"
                  class="absolute inset-y-0 right-3 my-auto h-8 rounded-lg px-2 text-xs font-semibold text-slate-400
                         transition hover:text-neon-bleu">
            {{ afficherMotDePasse() ? 'Masquer' : 'Afficher' }}
          </button>
        </div>
        @if (champInvalide('password')) {
          <p class="mt-1 text-xs text-neon-rouge">Le mot de passe est obligatoire.</p>
        }

        <!-- Bouton -->
        <button type="submit" [disabled]="chargement()"
                class="mt-8 w-full rounded-xl bg-neon-bleu py-3 font-bold text-noir-950 transition
                       hover:glow-bleu hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
          {{ chargement() ? 'Connexion en cours…' : 'Se connecter' }}
        </button>
      </form>

      <p class="mt-6 text-center text-xs text-slate-500">
        © Dalal Immobilier — Ici, vous êtes chez vous.
      </p>
    </div>
  </div>
  `,
})
export class Connexion {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  chargement = signal(false);
  erreur = signal<string | null>(null);
  afficherMotDePasse = signal(false);

  formulaire = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  champInvalide(nom: 'email' | 'password'): boolean {
    const champ = this.formulaire.controls[nom];
    return champ.invalid && (champ.touched || champ.dirty);
  }

  seConnecter(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }

    this.chargement.set(true);
    this.erreur.set(null);
    const { email, password } = this.formulaire.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl(this.auth.routeAccueil()),
      error: (e: HttpErrorResponse) => {
        this.chargement.set(false);
        this.erreur.set(this.messageErreur(e));
      },
    });
  }

  private messageErreur(e: HttpErrorResponse): string {
    switch (e.status) {
      case 0:   return 'Impossible de joindre le serveur. Vérifiez que l’API Laravel est lancée.';
      case 422: return e.error?.errors?.email?.[0] ?? 'Email ou mot de passe incorrect.';
      case 403: return e.error?.message ?? 'Votre compte est désactivé.';
      case 429: return 'Trop de tentatives. Patientez une minute avant de réessayer.';
      default:  return 'Une erreur est survenue. Réessayez plus tard.';
    }
  }
}