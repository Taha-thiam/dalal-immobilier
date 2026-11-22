import { Component, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-mon-mot-de-passe',
    standalone: true,
    imports: [FormsModule],
    template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-lg">
      <h1 class="text-3xl font-extrabold text-white">Mon mot de passe</h1>
      <p class="mt-1 text-slate-400">{{ auth.user()?.prenom }} {{ auth.user()?.nom }} · {{ auth.user()?.email }}</p>

      @if (parDefaut()) {
        <div class="mt-6 rounded-xl border border-neon-rouge/60 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge glow-rouge">
          🔐 Vous utilisez encore le mot de passe par défaut. Choisissez un mot de passe personnel.
        </div>
      }

      @if (succes()) {
        <div class="mt-6 rounded-2xl border border-emerald-400/50 bg-emerald-400/10 p-6 text-center">
          <p class="text-4xl">✅</p>
          <p class="mt-3 font-semibold text-emerald-300">{{ succes() }}</p>
        </div>
      } @else {
        <form (ngSubmit)="enregistrer()" class="mt-6 grid gap-4 rounded-2xl border border-noir-600 bg-noir-800/60 p-6">
          <label class="text-sm text-slate-300">Mot de passe actuel *
            <div class="relative mt-1.5">
              <input [type]="voir() ? 'text' : 'password'" name="actuel" [(ngModel)]="form.mot_de_passe_actuel" autocomplete="current-password" [class]="champ" />
            </div>
          </label>
          <label class="text-sm text-slate-300">Nouveau mot de passe *
            <input [type]="voir() ? 'text' : 'password'" name="nouveau" [(ngModel)]="form.nouveau" autocomplete="new-password" [class]="champ + ' mt-1.5'" />
          </label>

          <!-- Jauge de solidité -->
          <div>
            <div class="flex gap-1.5">
              @for (n of [1, 2, 3, 4]; track n) {
                <div class="h-1.5 flex-1 rounded-full transition" [class]="n <= force() ? couleurForce() : 'bg-noir-600'"></div>
              }
            </div>
            <ul class="mt-2 space-y-0.5 text-xs">
              <li [class]="form.nouveau.length >= 6 ? 'text-emerald-300' : 'text-slate-500'">{{ form.nouveau.length >= 6 ? '✓' : '○' }} Au moins 6 caractères</li>
              <li [class]="aLettre() ? 'text-emerald-300' : 'text-slate-500'">{{ aLettre() ? '✓' : '○' }} Au moins une lettre</li>
              <li [class]="aChiffre() ? 'text-emerald-300' : 'text-slate-500'">{{ aChiffre() ? '✓' : '○' }} Au moins un chiffre</li>
            </ul>
          </div>

          <label class="text-sm text-slate-300">Confirmer le nouveau mot de passe *
            <input [type]="voir() ? 'text' : 'password'" name="confirmation" [(ngModel)]="form.nouveau_confirmation" autocomplete="new-password" [class]="champ + ' mt-1.5'" />
          </label>
          @if (form.nouveau_confirmation && form.nouveau !== form.nouveau_confirmation) {
            <p class="-mt-2 text-xs text-neon-rouge">Les deux mots de passe ne sont pas identiques.</p>
          }

          <label class="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" [checked]="voir()" (change)="voir.set(!voir())" class="accent-cyan-400" /> Afficher les mots de passe
          </label>

          @if (erreur()) { <p class="text-sm text-neon-rouge">{{ erreur() }}</p> }

          <button type="submit" [disabled]="envoi()" class="rounded-xl bg-neon-bleu py-3 font-bold text-noir-950 transition hover:glow-bleu disabled:opacity-60">
            {{ envoi() ? 'Enregistrement…' : 'Changer mon mot de passe' }}
          </button>
          <p class="text-center text-xs text-slate-500">Vos autres appareils seront déconnectés.</p>
        </form>
      }
    </div>
  </div>
  `,
})
export class MonMotDePasse {
    private http = inject(HttpClient);
    auth = inject(AuthService);

    form = { mot_de_passe_actuel: '', nouveau: '', nouveau_confirmation: '' };
    voir = signal(false);
    envoi = signal(false);
    succes = signal<string | null>(null);
    erreur = signal<string | null>(null);

    champ = 'w-full rounded-xl border border-noir-600 bg-noir-900 px-4 py-3 text-white outline-none transition focus:border-neon-bleu focus:glow-bleu';

    parDefaut(): boolean {
        return !!(this.auth.user() as unknown as { mot_de_passe_par_defaut?: boolean })?.mot_de_passe_par_defaut;
    }

    aLettre(): boolean { return /[a-zA-Z]/.test(this.form.nouveau); }
    aChiffre(): boolean { return /\d/.test(this.form.nouveau); }
    force(): number {
        const m = this.form.nouveau;
        return (m.length >= 6 ? 1 : 0) + (this.aLettre() ? 1 : 0) + (this.aChiffre() ? 1 : 0) + (m.length >= 10 || /[^a-zA-Z0-9]/.test(m) ? 1 : 0);
    }
    couleurForce(): string {
        return ['bg-neon-rouge', 'bg-neon-rouge', 'bg-amber-300', 'bg-emerald-400', 'bg-emerald-400'][this.force()];
    }

    enregistrer(): void {
        this.envoi.set(true);
        this.erreur.set(null);
        this.http.put<{ message: string; user: unknown }>(`${environment.apiUrl}/mot-de-passe`, this.form).subscribe({
            next: (r) => {
                this.envoi.set(false);
                this.succes.set(r.message);
                // Met à jour le profil mémorisé (le rappel « mot de passe par défaut » disparaît)
                try { localStorage.setItem('dalal_user', JSON.stringify(r.user)); } catch { }
                setTimeout(() => window.location.reload(), 1800);
            },
            error: (e: HttpErrorResponse) => {
                this.envoi.set(false);
                const erreurs = e.error?.errors as Record<string, string[]> | undefined;
                this.erreur.set(erreurs ? Object.values(erreurs)[0]?.[0] : (e.error?.message ?? 'Une erreur est survenue.'));
            },
        });
    }
}