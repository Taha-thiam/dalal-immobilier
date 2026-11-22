import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-mot-de-passe-oublie',
    standalone: true,
    imports: [FormsModule, RouterLink],
    template: `
  <div class="relative grid min-h-screen place-items-center overflow-hidden bg-noir-950 px-4">
    <div class="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-neon-bleu/20 blur-3xl"></div>
    <div class="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-neon-rouge/20 blur-3xl"></div>

    <div class="relative w-full max-w-md rounded-2xl border border-neon-bleu/40 bg-noir-900/90 p-8 glow-bleu backdrop-blur">
      <a routerLink="/" class="text-xl font-extrabold text-white">Dalal <span class="text-neon-bleu text-glow-bleu">Immobilier</span></a>

      @if (envoye()) {
        <div class="mt-8 text-center">
          <p class="text-5xl">📨</p>
          <h1 class="mt-4 text-xl font-bold text-white">Demande envoyée</h1>
          <p class="mt-3 text-sm text-slate-300">{{ envoye() }}</p>
          <p class="mt-3 text-xs text-slate-500">Votre nouveau mot de passe provisoire sera <span class="font-mono text-neon-bleu">passer</span>. Pensez à le changer dès votre connexion.</p>
          <a routerLink="/connexion" class="mt-6 inline-block rounded-xl bg-neon-bleu px-6 py-3 font-bold text-noir-950 hover:glow-bleu">Retour à la connexion</a>
        </div>
      } @else {
        <h1 class="mt-6 text-2xl font-extrabold text-white">Mot de passe oublié ?</h1>
        <p class="mt-2 text-sm text-slate-400">
          Saisissez l'e-mail de votre compte. L'administrateur de l'agence recevra votre demande et réinitialisera votre mot de passe.
        </p>

        <form (ngSubmit)="envoyer()" class="mt-6 grid gap-4">
          <input type="email" name="email" [(ngModel)]="email" placeholder="votre@email.com" autocomplete="email"
                 class="w-full rounded-xl border border-noir-600 bg-noir-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu" />
          @if (erreur()) { <p class="text-sm text-neon-rouge">{{ erreur() }}</p> }
          <button type="submit" [disabled]="envoi() || !email.trim()"
                  class="rounded-xl bg-neon-rouge py-3 font-bold text-white transition hover:glow-rouge disabled:opacity-60">
            {{ envoi() ? 'Envoi…' : 'Envoyer la demande' }}
          </button>
        </form>

        <a routerLink="/connexion" class="mt-6 block text-center text-sm text-slate-400 hover:text-neon-bleu">← Retour à la connexion</a>
      }
    </div>
  </div>
  `,
})
export class MotDePasseOublie {
    private http = inject(HttpClient);

    email = '';
    envoi = signal(false);
    envoye = signal<string | null>(null);
    erreur = signal<string | null>(null);

    envoyer(): void {
        this.envoi.set(true);
        this.erreur.set(null);
        this.http.post<{ message: string }>(`${environment.apiUrl}/mot-de-passe-oublie`, { email: this.email.trim() }).subscribe({
            next: (r) => { this.envoi.set(false); this.envoye.set(r.message); },
            error: (e: HttpErrorResponse) => {
                this.envoi.set(false);
                const erreurs = e.error?.errors as Record<string, string[]> | undefined;
                this.erreur.set(e.status === 429
                    ? 'Trop de demandes. Réessayez dans une minute.'
                    : erreurs ? Object.values(erreurs)[0]?.[0] : 'Envoi impossible.');
            },
        });
    }
}