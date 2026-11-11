import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ProprietaireService } from '../../core/services/proprietaire.service';
import { Proprietaire } from '../../core/models/proprietaire.model';
import { Page } from '../../core/models/pagination.model';
import { ProprietaireForm, ResultatFormulaire } from './proprietaire-form';

@Component({
    selector: 'app-proprietaires',
    standalone: true,
    imports: [ProprietaireForm],
    template: `
     <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-6xl">

     
      <!-- En-tête -->
      <div class="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold text-white">Propriétaires</h1>
          <p class="mt-1 text-slate-400">
            {{ page()?.total ?? 0 }} propriétaire(s) enregistré(s)
          </p>
        </div>
        <button (click)="ouvrirCreation()"
                class="rounded-xl bg-neon-bleu px-5 py-2.5 font-bold text-noir-950 transition hover:glow-bleu hover:brightness-110">
          + Nouveau propriétaire
        </button>
      </div>

      <!-- Notification de succès -->
      @if (notification()) {
        <div class="mt-6 flex items-start justify-between gap-4 rounded-xl border border-neon-bleu/50 bg-neon-bleu/10 px-4 py-3 text-sm text-neon-bleu">
          <span>{{ notification() }}</span>
          <button (click)="notification.set(null)" class="text-lg leading-none hover:text-white">×</button>
        </div>
      }

      <!-- Mot de passe temporaire (affiché une seule fois) -->
      @if (motDePasse()) {
        <div class="mt-4 rounded-xl border border-neon-rouge/60 bg-neon-rouge/10 p-4 glow-rouge">
          <p class="text-sm font-semibold text-neon-rouge">Mot de passe temporaire du propriétaire</p>
          <p class="mt-1 text-xs text-slate-400">Communiquez-le au propriétaire : il ne sera plus affiché.</p>
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <code class="rounded-lg bg-noir-900 px-3 py-1.5 font-mono text-lg tracking-wider text-white">{{ motDePasse() }}</code>
            <button (click)="copier()" class="rounded-lg border border-neon-rouge/60 px-3 py-1.5 text-sm text-neon-rouge transition hover:bg-neon-rouge/10">
              {{ copie() ? 'Copié ✓' : 'Copier' }}
            </button>
            <button (click)="motDePasse.set(null)" class="text-sm text-slate-400 hover:text-white">J'ai noté</button>
          </div>
        </div>
      }

      <!-- Recherche -->
      <div class="mt-6">
        <input type="search" placeholder="Rechercher par nom, prénom, email ou téléphone…"
               (input)="rechercher($any($event.target).value)"
               class="w-full rounded-xl border border-noir-600 bg-noir-900 px-4 py-3 text-white outline-none transition
                      placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu md:max-w-md" />
      </div>

      <!-- Erreur de chargement -->
      @if (erreur()) {
        <div class="mt-6 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">{{ erreur() }}</div>
      }

      <!-- Tableau -->
      <div class="mt-6 overflow-x-auto rounded-2xl border border-noir-600 bg-noir-800/60">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-noir-600 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th class="px-5 py-4">Propriétaire</th>
              <th class="px-5 py-4">Contact</th>
              <th class="px-5 py-4">Adresse</th>
              <th class="px-5 py-4 text-center">Biens</th>
              <th class="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (chargement()) {
              @for (i of [1, 2, 3]; track i) {
                <tr class="border-b border-noir-700">
                  <td colspan="5" class="px-5 py-4"><div class="h-5 animate-pulse rounded bg-noir-700"></div></td>
                </tr>
              }
            } @else {
              @for (p of page()?.data ?? []; track p.id) {
                <tr class="border-b border-noir-700 transition hover:bg-noir-700/50">
                  <td class="px-5 py-4">
                    <div class="flex items-center gap-3">
                      <div class="grid h-10 w-10 place-items-center rounded-full border border-neon-bleu/50 bg-neon-bleu/10 font-bold text-neon-bleu">
                        {{ p.prenom.charAt(0) }}{{ p.nom.charAt(0) }}
                      </div>
                      <div>
                        <p class="font-semibold text-white">{{ p.prenom }} {{ p.nom }}</p>
                        <p class="text-xs text-slate-500">CNI : {{ p.numero_cni || '—' }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-5 py-4">
                    <p class="text-slate-300">{{ p.email }}</p>
                    <p class="text-xs text-slate-500">{{ p.telephone || '—' }}</p>
                  </td>
                  <td class="px-5 py-4 text-slate-400">{{ p.adresse || '—' }}</td>
                  <td class="px-5 py-4 text-center">
                    <span class="rounded-full border border-noir-600 px-3 py-1 font-semibold"
                          [class]="p.biens_count > 0 ? 'text-neon-bleu border-neon-bleu/50' : 'text-slate-400'">
                      {{ p.biens_count }}
                    </span>
                  </td>
                  <td class="px-5 py-4 text-right">
                    <button (click)="ouvrirModification(p)"
                            class="rounded-lg px-3 py-1.5 text-sm font-semibold text-neon-bleu transition hover:bg-neon-bleu/10">
                      Modifier
                    </button>
                    <button (click)="aSupprimer.set(p)"
                            class="rounded-lg px-3 py-1.5 text-sm font-semibold text-neon-rouge transition hover:bg-neon-rouge/10">
                      Supprimer
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="px-5 py-12 text-center text-slate-500">
                    Aucun propriétaire trouvé.
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      @if (page(); as pg) {
        @if (pg.last_page > 1) {
          <div class="mt-4 flex items-center justify-between text-sm text-slate-400">
            <span>{{ pg.from }} à {{ pg.to }} sur {{ pg.total }}</span>
            <div class="flex gap-2">
              <button (click)="charger(pg.current_page - 1)" [disabled]="pg.current_page === 1"
                      class="rounded-lg border border-noir-600 px-3 py-1.5 transition hover:border-neon-bleu hover:text-neon-bleu disabled:opacity-40 disabled:hover:border-noir-600 disabled:hover:text-slate-400">
                ← Précédent
              </button>
              <span class="px-2 py-1.5">Page {{ pg.current_page }} / {{ pg.last_page }}</span>
              <button (click)="charger(pg.current_page + 1)" [disabled]="pg.current_page === pg.last_page"
                      class="rounded-lg border border-noir-600 px-3 py-1.5 transition hover:border-neon-bleu hover:text-neon-bleu disabled:opacity-40 disabled:hover:border-noir-600 disabled:hover:text-slate-400">
                Suivant →
              </button>
            </div>
          </div>
        }
      }
    </div>
  </div>

  <!-- Fenêtre de création / modification -->
  @if (formulaireOuvert()) {
    <app-proprietaire-form
      [proprietaire]="selection()"
      (ferme)="fermerFormulaire()"
      (enregistre)="apresEnregistrement($event)" />
  }

  <!-- Fenêtre de confirmation de suppression -->
  @if (aSupprimer(); as p) {
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="aSupprimer.set(null)">
      <div class="w-full max-w-md rounded-2xl border border-neon-rouge/50 bg-noir-800 p-6 glow-rouge" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-white">Supprimer ce propriétaire ?</h2>
        <p class="mt-2 text-slate-400">
          <span class="font-semibold text-white">{{ p.prenom }} {{ p.nom }}</span> et son compte de connexion seront supprimés définitivement.
        </p>
        @if (erreurSuppression()) {
          <p class="mt-3 rounded-lg bg-neon-rouge/10 px-3 py-2 text-sm text-neon-rouge">{{ erreurSuppression() }}</p>
        }
        <div class="mt-6 flex justify-end gap-3">
          <button (click)="aSupprimer.set(null)"
                  class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 transition hover:bg-noir-700">
            Annuler
          </button>
          <button (click)="confirmerSuppression(p)" [disabled]="suppressionEnCours()"
                  class="rounded-xl bg-neon-rouge px-5 py-2.5 font-bold text-white transition hover:glow-rouge disabled:opacity-60">
            {{ suppressionEnCours() ? 'Suppression…' : 'Supprimer' }}
          </button>
        </div>
      </div>
    </div>
  }
  `,
})
export class Proprietaires implements OnInit {
    private service = inject(ProprietaireService);
    private destroyRef = inject(DestroyRef);

    page = signal<Page<Proprietaire> | null>(null);
    chargement = signal(true);
    erreur = signal<string | null>(null);
    notification = signal<string | null>(null);
    motDePasse = signal<string | null>(null);
    copie = signal(false);

    formulaireOuvert = signal(false);
    selection = signal<Proprietaire | null>(null);

    aSupprimer = signal<Proprietaire | null>(null);
    suppressionEnCours = signal(false);
    erreurSuppression = signal<string | null>(null);

    private recherche = '';
    private recherche$ = new Subject<string>();

    ngOnInit(): void {
        // Attend 300 ms après la dernière frappe avant d'interroger l'API
        this.recherche$
            .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
            .subscribe((texte) => {
                this.recherche = texte;
                this.charger(1);
            });

        this.charger(1);
    }

    charger(numero: number): void {
        this.chargement.set(true);
        this.erreur.set(null);
        this.service.lister(numero, this.recherche).subscribe({
            next: (resultat) => {
                this.page.set(resultat);
                this.chargement.set(false);
            },
            error: () => {
                this.erreur.set('Impossible de charger les propriétaires.');
                this.chargement.set(false);
            },
        });
    }

    rechercher(texte: string): void {
        this.recherche$.next(texte);
    }

    ouvrirCreation(): void {
        this.selection.set(null);
        this.formulaireOuvert.set(true);
    }

    ouvrirModification(p: Proprietaire): void {
        this.selection.set(p);
        this.formulaireOuvert.set(true);
    }

    fermerFormulaire(): void {
        this.formulaireOuvert.set(false);
        this.selection.set(null);
    }

    apresEnregistrement(resultat: ResultatFormulaire): void {
        this.fermerFormulaire();
        this.notification.set(resultat.message);
        this.motDePasse.set(resultat.motDePasseTemporaire ?? null);
        this.copie.set(false);
        this.charger(this.page()?.current_page ?? 1);
    }

    confirmerSuppression(p: Proprietaire): void {
        this.suppressionEnCours.set(true);
        this.erreurSuppression.set(null);
        this.service.supprimer(p.id).subscribe({
            next: (r) => {
                this.suppressionEnCours.set(false);
                this.aSupprimer.set(null);
                this.notification.set(r.message);
                this.charger(1);
            },
            error: (e: HttpErrorResponse) => {
                this.suppressionEnCours.set(false);
                this.erreurSuppression.set(e.error?.message ?? 'Suppression impossible.');
            },
        });
    }

    copier(): void {
        const mdp = this.motDePasse();
        if (mdp) {
            navigator.clipboard.writeText(mdp).then(() => this.copie.set(true));
        }
    }
}