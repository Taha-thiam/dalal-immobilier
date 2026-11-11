import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ROLE_LIBELLES } from '../../core/models/user.model';

@Component({
  selector: 'app-accueil',
  standalone: true,
  imports: [RouterLink],
  template: `
  <div class="relative overflow-hidden px-4 py-8 md:px-8">
    <!-- Halo décoratif -->
    <div class="pointer-events-none absolute -top-32 right-0 h-80 w-80 rounded-full bg-neon-bleu/10 blur-3xl"></div>

    <div class="relative mx-auto max-w-5xl">
      @if (auth.user(); as user) {

        <!-- Bienvenue -->
        <section class="rounded-2xl border border-noir-600 bg-noir-800/70 p-8 backdrop-blur">
          <p class="text-sm text-slate-400">{{ salutation() }},</p>
          <h1 class="mt-1 text-3xl font-extrabold text-white">{{ user.prenom }} {{ user.nom }}</h1>
          <span class="mt-4 inline-block rounded-full border border-neon-bleu/50 bg-neon-bleu/10 px-3 py-1
                       text-xs font-semibold uppercase tracking-wider text-neon-bleu">
            {{ libelleRole() }}
          </span>
        </section>

        <!-- Raccourcis -->
        @if (auth.aLeRole('gestionnaire', 'administrateur')) {
          <h2 class="mt-10 text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Accès rapide</h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a routerLink="/gestion/proprietaires"
               class="group rounded-2xl border border-noir-600 bg-noir-800/70 p-6 transition duration-300
                      hover:-translate-y-1 hover:border-neon-bleu/60 hover:glow-bleu">
              <p class="text-lg font-bold text-white group-hover:text-neon-bleu">Propriétaires</p>
              <p class="mt-1 text-sm text-slate-400">Consulter, ajouter et modifier les propriétaires.</p>
              <p class="mt-4 text-sm font-semibold text-neon-bleu">Ouvrir →</p>
            </a>

            <div class="rounded-2xl border border-dashed border-noir-600 p-6 text-slate-600">
              <p class="text-lg font-bold">Biens</p>
              <p class="mt-1 text-sm">Disponible prochainement.</p>
            </div>

            <div class="rounded-2xl border border-dashed border-noir-600 p-6 text-slate-600">
              <p class="text-lg font-bold">Baux</p>
              <p class="mt-1 text-sm">Disponible prochainement.</p>
            </div>
          </div>
        } @else {
          <p class="mt-8 text-slate-400">
            Votre espace est en cours de construction. Les modules apparaîtront ici au fil du développement.
          </p>
        }
      }
    </div>
  </div>
  `,
})
export class Accueil implements OnInit {
  auth = inject(AuthService);

  libelleRole = computed(() => {
    const role = this.auth.user()?.role;
    return role ? ROLE_LIBELLES[role] : '';
  });

  /** « Bonjour » avant 18 h, « Bonsoir » après */
  salutation(): string {
    return new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir';
  }

  ngOnInit(): void {
    // Vérifie auprès de Laravel que le jeton est toujours valide.
    // S'il ne l'est plus (401), l'intercepteur déconnecte automatiquement.
    this.auth.rafraichirProfil().subscribe();
  }
}