import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { BienService } from '../../core/services/bien.service';
import { Bien, FiltresBien, STATUTS_BIEN, StatutBien, TYPES_BIEN, TypeBien } from '../../core/models/bien.model';
import { Page } from '../../core/models/pagination.model';
import { BienForm, ResultatBien } from './bien-form';

@Component({
    selector: 'app-biens',
    standalone: true,
    imports: [RouterLink, BienForm],
    template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-7xl">

      <!-- En-tête -->
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold text-white">Biens</h1>
          <p class="mt-1 text-slate-400">{{ page()?.total ?? 0 }} bien(s) dans le portefeuille</p>
        </div>
        <button (click)="formulaireOuvert.set(true)"
                class="rounded-xl bg-neon-bleu px-5 py-2.5 font-bold text-noir-950 transition hover:glow-bleu hover:brightness-110">
          + Nouveau bien
        </button>
      </div>

      @if (notification()) {
        <div class="mt-6 flex items-start justify-between gap-4 rounded-xl border border-neon-bleu/50 bg-neon-bleu/10 px-4 py-3 text-sm text-neon-bleu">
          <span>{{ notification() }}</span>
          <button (click)="notification.set(null)" class="text-lg leading-none hover:text-white">×</button>
        </div>
      }

      <!-- Filtres -->
      <div class="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <input type="search" placeholder="Rechercher : titre, référence, quartier, adresse…"
               (input)="rechercher($any($event.target).value)" [class]="champ" />
        <select (change)="filtrerStatut($any($event.target).value)" [class]="champ">
          <option value="">Tous les statuts</option>
          @for (s of statuts; track s.valeur) { <option [value]="s.valeur">{{ s.libelle }}</option> }
        </select>
        <select (change)="filtrerType($any($event.target).value)" [class]="champ">
          <option value="">Tous les types</option>
          @for (t of types; track t.valeur) { <option [value]="t.valeur">{{ t.libelle }}</option> }
        </select>
      </div>

      @if (erreur()) {
        <div class="mt-6 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">{{ erreur() }}</div>
      }

      <!-- Grille de cartes -->
      <div class="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        @if (chargement()) {
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="h-80 animate-pulse rounded-2xl border border-noir-600 bg-noir-800"></div>
          }
        } @else {
          @for (b of page()?.data ?? []; track b.id) {
            <a [routerLink]="['/gestion/biens', b.id]"
               class="group overflow-hidden rounded-2xl border border-noir-600 bg-noir-800/70 transition duration-300
                      hover:-translate-y-1 hover:border-neon-bleu/60 hover:glow-bleu">

              <!-- Photo -->
              <div class="relative h-48 overflow-hidden bg-noir-900">
                @if (b.photo_principale) {
                  <img [src]="b.photo_principale" [alt]="b.titre" loading="lazy"
                       class="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                } @else {
                  <div class="grid h-full place-items-center text-sm text-slate-600">Aucune photo</div>
                }
                <!-- Dégradé pour lisibilité des badges -->
                <div class="absolute inset-0 bg-gradient-to-t from-noir-950/80 via-transparent to-transparent"></div>

                <!-- Badges -->
                <span class="absolute left-3 top-3 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur"
                      [class]="classeStatut(b.statut)">
                  {{ libelleStatut(b.statut) }}
                </span>
                @if (b.publie) {
                  <span class="absolute right-3 top-3 rounded-full border border-neon-bleu/60 bg-noir-950/70 px-3 py-1 text-xs font-semibold text-neon-bleu backdrop-blur">
                    ● En ligne
                  </span>
                }
                <span class="absolute bottom-3 right-3 rounded-full bg-noir-950/70 px-2.5 py-1 text-xs text-slate-300 backdrop-blur">
                  📷 {{ b.photos_count }}
                </span>
              </div>

              <!-- Infos -->
              <div class="p-5">
                <p class="text-xs uppercase tracking-wider text-slate-500">{{ b.reference }} · {{ libelleType(b.type) }}</p>
                <h3 class="mt-1 line-clamp-1 text-lg font-bold text-white group-hover:text-neon-bleu">{{ b.titre }}</h3>
                <p class="mt-1 text-sm text-slate-400">{{ b.quartier }}</p>

                <div class="mt-4 flex items-end justify-between">
                  <p class="text-xl font-extrabold text-neon-bleu">
                    {{ montant(b.loyer_propose) }} <span class="text-xs font-medium text-slate-500">/ mois</span>
                  </p>
                  <p class="text-xs text-slate-500">
                    @if (b.nb_pieces) { {{ b.nb_pieces }} pièces }
                    @if (b.nb_pieces && b.surface) { · }
                    @if (b.surface) { {{ +b.surface }} m² }
                  </p>
                </div>

                @if (b.proprietaire) {
                  <p class="mt-3 border-t border-noir-700 pt-3 text-xs text-slate-500">
                    Propriétaire : <span class="text-slate-300">{{ b.proprietaire.prenom }} {{ b.proprietaire.nom }}</span>
                  </p>
                }
              </div>
            </a>
          } @empty {
            <div class="col-span-full rounded-2xl border border-dashed border-noir-600 px-6 py-16 text-center text-slate-500">
              Aucun bien trouvé.
            </div>
          }
        }
      </div>

      <!-- Pagination -->
      @if (page(); as pg) {
        @if (pg.last_page > 1) {
          <div class="mt-6 flex items-center justify-between text-sm text-slate-400">
            <span>{{ pg.from }} à {{ pg.to }} sur {{ pg.total }}</span>
            <div class="flex gap-2">
              <button (click)="charger(pg.current_page - 1)" [disabled]="pg.current_page === 1"
                      class="rounded-lg border border-noir-600 px-3 py-1.5 transition hover:border-neon-bleu hover:text-neon-bleu disabled:opacity-40">← Précédent</button>
              <span class="px-2 py-1.5">Page {{ pg.current_page }} / {{ pg.last_page }}</span>
              <button (click)="charger(pg.current_page + 1)" [disabled]="pg.current_page === pg.last_page"
                      class="rounded-lg border border-noir-600 px-3 py-1.5 transition hover:border-neon-bleu hover:text-neon-bleu disabled:opacity-40">Suivant →</button>
            </div>
          </div>
        }
      }
    </div>
  </div>

  @if (formulaireOuvert()) {
    <app-bien-form (ferme)="formulaireOuvert.set(false)" (enregistre)="apresEnregistrement($event)" />
  }
  `,
})
export class Biens implements OnInit {
    private service = inject(BienService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);

    types = TYPES_BIEN;
    statuts = (Object.keys(STATUTS_BIEN) as StatutBien[]).map((s) => ({ valeur: s, libelle: STATUTS_BIEN[s] }));

    page = signal<Page<Bien> | null>(null);
    chargement = signal(true);
    erreur = signal<string | null>(null);
    notification = signal<string | null>(null);
    formulaireOuvert = signal(false);

    private filtres: FiltresBien = {};
    private recherche$ = new Subject<string>();

    champ = 'w-full rounded-xl border border-noir-600 bg-noir-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

    ngOnInit(): void {
        this.recherche$
            .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
            .subscribe((texte) => {
                this.filtres.recherche = texte;
                this.charger(1);
            });
        this.charger(1);
    }

    charger(numero: number): void {
        this.chargement.set(true);
        this.erreur.set(null);
        this.service.lister(numero, this.filtres).subscribe({
            next: (r) => { this.page.set(r); this.chargement.set(false); },
            error: () => { this.erreur.set('Impossible de charger les biens.'); this.chargement.set(false); },
        });
    }

    rechercher(texte: string): void { this.recherche$.next(texte); }
    filtrerStatut(statut: StatutBien | ''): void { this.filtres.statut = statut; this.charger(1); }
    filtrerType(type: TypeBien | ''): void { this.filtres.type = type; this.charger(1); }

    apresEnregistrement(r: ResultatBien): void {
        this.formulaireOuvert.set(false);
        // Après une création, on ouvre directement la fiche pour ajouter les photos
        this.router.navigate(['/gestion/biens', r.bienId], { state: { message: r.message } });
    }

    // ----- Affichage -----

    montant(valeur: string | number): string {
        return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(valeur)) + ' FCFA';
    }

    libelleType(type: TypeBien): string {
        return this.types.find((t) => t.valeur === type)?.libelle ?? type;
    }

    libelleStatut(statut: StatutBien): string {
        return STATUTS_BIEN[statut];
    }

    classeStatut(statut: StatutBien): string {
        switch (statut) {
            case 'libre': return 'border-emerald-400/60 bg-noir-950/70 text-emerald-300';
            case 'loue': return 'border-neon-rouge/60 bg-noir-950/70 text-neon-rouge';
            default: return 'border-slate-500/60 bg-noir-950/70 text-slate-400';
        }
    }
}