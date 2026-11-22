import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ROLE_LIBELLES, Role } from '../core/models/user.model';

interface EntreeMenu {
  libelle: string;
  lien: string;
  roles: Role[];
  disponible: boolean; // false = module pas encore développé
}

/** Menu complet de l'application : chaque rôle ne voit que ses entrées. */
const MENU: EntreeMenu[] = [
  { libelle: 'Mots de passe', lien: '/admin/mots-de-passe', roles: ['administrateur'], disponible: true },
  // Administrateur
  { libelle: 'Tableau de bord', lien: '/admin', roles: ['administrateur'], disponible: true },
  { libelle: 'Comptes du personnel', lien: '/admin/comptes', roles: ['administrateur'], disponible: true },
  { libelle: 'Paramètres', lien: '/admin/parametres', roles: ['administrateur'], disponible: true },
  { libelle: 'Journal d’activité', lien: '/admin/journal', roles: ['administrateur'], disponible: true },
  // Gestionnaire
  { libelle: 'Tableau de bord', lien: '/gestion', roles: ['gestionnaire'], disponible: true },

  // Patrimoine (gestionnaire + administrateur)
  { libelle: 'Propriétaires', lien: '/gestion/proprietaires', roles: ['gestionnaire', 'administrateur'], disponible: true },
  { libelle: 'Biens', lien: '/gestion/biens', roles: ['gestionnaire', 'administrateur'], disponible: true },
  { libelle: 'Locataires', lien: '/gestion/locataires', roles: ['gestionnaire', 'administrateur'], disponible: true },
  { libelle: 'Baux', lien: '/gestion/baux', roles: ['gestionnaire', 'administrateur'], disponible: true },
  { libelle: 'Demandes', lien: '/gestion/demandes', roles: ['gestionnaire', 'administrateur'], disponible: true },
  { libelle: 'Maintenance', lien: '/gestion/maintenance', roles: ['gestionnaire'], disponible: true },

  // Comptabilité (comptable + administrateur)
  { libelle: 'Tableau de bord', lien: '/comptabilite', roles: ['comptable'], disponible: true },
  { libelle: 'Paiements', lien: '/comptabilite/paiements', roles: ['comptable', 'administrateur'], disponible: true },
  { libelle: 'Impayés', lien: '/comptabilite/impayes', roles: ['comptable', 'administrateur'], disponible: true },
  { libelle: 'Cautions', lien: '/comptabilite/cautions', roles: ['comptable', 'administrateur'], disponible: true },
  { libelle: 'Reversements', lien: '/comptabilite/reversements', roles: ['comptable', 'administrateur'], disponible: true },

  // Propriétaire
  { libelle: 'Mon espace', lien: '/proprietaire', roles: ['proprietaire'], disponible: true },

  // Locataire
  { libelle: 'Mon espace', lien: '/locataire', roles: ['locataire'], disponible: true },
];

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
  <div class="min-h-screen bg-noir-950 text-slate-200">

    <!-- Fond sombre derrière le menu sur mobile -->
    @if (menuOuvert()) {
      <div class="fixed inset-0 z-30 bg-black/60 lg:hidden" (click)="menuOuvert.set(false)"></div>
    }

    <!-- ===== Menu latéral ===== -->
    <aside class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-noir-600 bg-noir-900 transition-transform duration-300 lg:translate-x-0"
           [class.-translate-x-full]="!menuOuvert()">

      <!-- Logo -->
      <div class="border-b border-noir-600 px-6 py-5">
        <p class="text-[10px] font-semibold uppercase tracking-[0.35em] text-neon-rouge text-glow-rouge animate-neon">Gestion immobilière</p>
        <p class="mt-1 text-xl font-extrabold text-white">Dalal <span class="text-neon-bleu text-glow-bleu">Immobilier</span></p>
      </div>

      <!-- Liens -->
      <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        @for (entree of menu(); track entree.lien) {
          @if (entree.disponible) {
            <a [routerLink]="entree.lien"
               routerLinkActive="!border-neon-bleu/60 !bg-neon-bleu/10 !text-neon-bleu glow-bleu"
               [routerLinkActiveOptions]="{ exact: true }"
               (click)="menuOuvert.set(false)"
               class="flex items-center gap-3 rounded-xl border border-transparent px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-noir-700 hover:text-white">
              <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
              {{ entree.libelle }}
            </a>
          } @else {
            <div class="flex cursor-not-allowed items-center justify-between rounded-xl px-4 py-2.5 text-sm text-slate-600">
              <span class="flex items-center gap-3">
                <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
                {{ entree.libelle }}
              </span>
              <span class="rounded-full border border-noir-600 px-2 py-0.5 text-[10px] uppercase tracking-wider">Bientôt</span>
            </div>
          }
        }
      </nav>

      <!-- Utilisateur -->
      @if (auth.user(); as user) {
        <div class="border-t border-noir-600 p-4">
          <div class="flex items-center gap-3">
            <div class="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-neon-bleu/50 bg-neon-bleu/10 font-bold text-neon-bleu">
              {{ user.prenom.charAt(0) }}{{ user.nom.charAt(0) }}
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-white">{{ user.prenom }} {{ user.nom }}</p>
              <p class="text-xs text-neon-bleu">{{ libelleRole() }}</p>
            </div>
          </div>
                    <a routerLink="/mon-mot-de-passe" (click)="menuOuvert.set(false)"
             class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-noir-600 py-2 text-sm font-semibold text-slate-300 transition hover:border-neon-bleu/60 hover:text-neon-bleu">
            🔑 Mon mot de passe
            @if (motDePasseParDefaut()) { <span class="h-2 w-2 rounded-full bg-neon-rouge animate-pulse"></span> }
          </a>
          <button (click)="auth.logout()"
                  class="mt-4 w-full rounded-xl border border-neon-rouge/60 py-2 text-sm font-semibold text-neon-rouge transition hover:bg-neon-rouge/10 hover:glow-rouge">
            Se déconnecter
          </button>
          
        </div>
      }
    </aside>

    <!-- ===== Zone principale ===== -->
    <div class="lg:pl-64">
      <!-- Barre du haut (mobile uniquement) -->
      <header class="sticky top-0 z-20 flex items-center justify-between border-b border-noir-600 bg-noir-900/90 px-4 py-3 backdrop-blur lg:hidden">
        <button (click)="menuOuvert.set(true)" aria-label="Ouvrir le menu"
                class="rounded-lg border border-noir-600 px-3 py-1.5 text-neon-bleu">☰</button>
        <p class="font-extrabold text-white">Dalal <span class="text-neon-bleu">Immobilier</span></p>
        <span class="w-10"></span>
      </header>

            @if (motDePasseParDefaut()) {
        <a routerLink="/mon-mot-de-passe"
           class="flex items-center justify-center gap-2 border-b border-neon-rouge/50 bg-neon-rouge/10 px-4 py-2.5 text-sm text-neon-rouge hover:bg-neon-rouge/20">
          🔐 Vous utilisez le mot de passe par défaut. <span class="font-bold underline">Changez-le maintenant →</span>
        </a>
      }
      <main>
        <router-outlet />
      </main>
    </div>
  </div>
  `,
})
export class Layout {
  auth = inject(AuthService);
  menuOuvert = signal(false);

  /** Entrées du menu visibles pour le rôle connecté */
  menu = computed(() => {
    const role = this.auth.user()?.role;
    return role ? MENU.filter((e) => e.roles.includes(role)) : [];
  });

  libelleRole = computed(() => {
    const role = this.auth.user()?.role;
    return role ? ROLE_LIBELLES[role] : '';
  });

  /** true tant que l'utilisateur garde le mot de passe par défaut « passer » */
  motDePasseParDefaut = computed(() =>
    !!(this.auth.user() as unknown as { mot_de_passe_par_defaut?: boolean })?.mot_de_passe_par_defaut);
}