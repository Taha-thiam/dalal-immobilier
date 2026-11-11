import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { BailService } from '../../core/services/bail.service';
import { Bail, STATUTS_BAIL, StatutBail } from '../../core/models/bail.model';
import { Page } from '../../core/models/pagination.model';
import { BailForm, ResultatBail } from './bail-form';

@Component({
    selector: 'app-baux',
    standalone: true,
    imports: [BailForm],
    template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-7xl">

      <!-- En-tête -->
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold text-white">Baux</h1>
          <p class="mt-1 text-slate-400">{{ page()?.total ?? 0 }} contrat(s) de location</p>
        </div>
        <button (click)="formulaireOuvert.set(true)"
                class="rounded-xl bg-neon-bleu px-5 py-2.5 font-bold text-noir-950 transition hover:glow-bleu hover:brightness-110">
          + Nouveau bail
        </button>
      </div>

      <!-- Filtres -->
      <div class="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
        <input type="search" placeholder="Rechercher : n° de bail, bien, locataire…"
               (input)="recherche$.next($any($event.target).value)" [class]="champ" />
        <select (change)="filtrerStatut($any($event.target).value)" [class]="champ">
          <option value="">Tous les statuts</option>
          @for (s of statuts; track s.valeur) { <option [value]="s.valeur">{{ s.libelle }}</option> }
        </select>
      </div>

      @if (erreur()) {
        <div class="mt-6 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">{{ erreur() }}</div>
      }

      <!-- Tableau -->
      <div class="mt-6 overflow-x-auto rounded-2xl border border-noir-600 bg-noir-800/60">
        <table class="w-full min-w-[920px] text-left text-sm">
          <thead class="border-b border-noir-600 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th class="px-5 py-4">Bail</th>
              <th class="px-5 py-4">Bien</th>
              <th class="px-5 py-4">Locataire</th>
              <th class="px-5 py-4">Période</th>
              <th class="px-5 py-4 text-right">Loyer</th>
              <th class="px-5 py-4">Statut</th>
            </tr>
          </thead>
          <tbody>
            @if (chargement()) {
              @for (i of [1, 2, 3]; track i) {
                <tr class="border-b border-noir-700"><td colspan="6" class="px-5 py-4"><div class="h-5 animate-pulse rounded bg-noir-700"></div></td></tr>
              }
            } @else {
              @for (b of page()?.data ?? []; track b.id) {
                <tr (click)="ouvrir(b.id)" class="cursor-pointer border-b border-noir-700 transition hover:bg-noir-700/50">
                  <td class="px-5 py-4 font-mono text-xs font-semibold text-neon-bleu">{{ b.numero }}</td>
                  <td class="px-5 py-4">
                    <p class="font-semibold text-white">{{ b.bien?.titre }}</p>
                    <p class="text-xs text-slate-500">{{ b.bien?.quartier }} · Propr. {{ b.proprietaire?.prenom }} {{ b.proprietaire?.nom }}</p>
                  </td>
                  <td class="px-5 py-4">
                    <p class="text-slate-200">{{ b.locataire?.prenom }} {{ b.locataire?.nom }}</p>
                    <p class="text-xs text-slate-500">{{ b.locataire?.telephone || '—' }}</p>
                  </td>
                  <td class="px-5 py-4">
                    <p class="text-xs text-slate-400">{{ date(b.date_debut) }} → {{ date(b.date_fin) }}</p>
                    <!-- Barre de progression du bail -->
                    <div class="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-noir-600">
                      <div class="h-full rounded-full transition-all"
                           [class]="joursRestants(b) <= 60 && b.statut === 'actif' ? 'bg-neon-rouge' : 'bg-neon-bleu'"
                           [style.width.%]="progression(b)"></div>
                    </div>
                    @if (b.statut === 'actif' && joursRestants(b) <= 60 && joursRestants(b) >= 0) {
                      <p class="mt-1 text-xs font-semibold text-neon-rouge animate-neon">Expire dans {{ joursRestants(b) }} jour(s)</p>
                    }
                  </td>
                  <td class="px-5 py-4 text-right font-semibold text-white">{{ montant(b.loyer_mensuel) }}</td>
                  <td class="px-5 py-4">
                    <span class="rounded-full border px-3 py-1 text-xs font-semibold" [class]="classeStatut(b.statut)">{{ libelleStatut(b.statut) }}</span>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="px-5 py-12 text-center text-slate-500">Aucun bail trouvé.</td></tr>
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
    <app-bail-form (ferme)="formulaireOuvert.set(false)" (enregistre)="apresCreation($event)" />
  }
  `,
})
export class Baux implements OnInit {
    private service = inject(BailService);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);

    statuts = (Object.keys(STATUTS_BAIL) as StatutBail[]).map((s) => ({ valeur: s, libelle: STATUTS_BAIL[s] }));

    page = signal<Page<Bail> | null>(null);
    chargement = signal(true);
    erreur = signal<string | null>(null);
    formulaireOuvert = signal(false);

    private texte = '';
    private statut: StatutBail | '' = '';
    recherche$ = new Subject<string>();

    champ = 'w-full rounded-xl border border-noir-600 bg-noir-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

    ngOnInit(): void {
        this.recherche$
            .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
            .subscribe((t) => { this.texte = t; this.charger(1); });
        this.charger(1);
    }

    charger(numero: number): void {
        this.chargement.set(true);
        this.erreur.set(null);
        this.service.lister(numero, this.texte, this.statut).subscribe({
            next: (r) => { this.page.set(r); this.chargement.set(false); },
            error: () => { this.erreur.set('Impossible de charger les baux.'); this.chargement.set(false); },
        });
    }

    filtrerStatut(statut: StatutBail | ''): void {
        this.statut = statut;
        this.charger(1);
    }

    ouvrir(id: number): void {
        this.router.navigate(['/gestion/baux', id]);
    }

    apresCreation(r: ResultatBail): void {
        this.formulaireOuvert.set(false);
        this.router.navigate(['/gestion/baux', r.bailId], { state: { message: r.message } });
    }

    // ----- Affichage -----

    /** Pourcentage du bail déjà écoulé (0 à 100) */
    progression(b: Bail): number {
        const debut = new Date(b.date_debut).getTime();
        const fin = new Date(b.date_fin).getTime();
        const ratio = (Date.now() - debut) / (fin - debut);
        return Math.max(0, Math.min(100, Math.round(ratio * 100)));
    }

    joursRestants(b: Bail): number {
        return Math.ceil((new Date(b.date_fin).getTime() - Date.now()) / 86_400_000);
    }

    montant(v: string | number): string {
        return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v)) + ' FCFA';
    }

    date(v: string): string {
        return new Date(v).toLocaleDateString('fr-FR');
    }

    libelleStatut(s: StatutBail): string {
        return STATUTS_BAIL[s];
    }

    classeStatut(s: StatutBail): string {
        switch (s) {
            case 'actif': return 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300';
            case 'resilie': return 'border-neon-rouge/60 bg-neon-rouge/10 text-neon-rouge';
            default: return 'border-slate-500/60 text-slate-400';
        }
    }
}