import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { PaiementService } from '../../core/services/paiement.service';
import { EcheanceAEncaisser } from '../../core/models/paiement.model';
import { Page } from '../../core/models/pagination.model';
import { PaiementForm } from './paiement-form';

@Component({
    selector: 'app-impayes',
    standalone: true,
    imports: [PaiementForm],
    template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-7xl">

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold text-white">
            Impayés <span class="text-neon-rouge text-glow-rouge">●</span>
          </h1>
          <p class="mt-1 text-slate-400">Les loyers dont la date limite est dépassée, les plus anciens en premier.</p>
        </div>
      </div>

      <!-- Indicateurs -->
      <div class="mt-6 grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-neon-rouge/50 bg-neon-rouge/5 p-5 glow-rouge">
          <p class="text-xs font-semibold uppercase tracking-wider text-neon-rouge">Montant en retard</p>
          <p class="mt-2 text-3xl font-extrabold text-white">{{ montant(totalRetard()) }}</p>
          @if ((page()?.last_page ?? 1) > 1) { <p class="mt-1 text-xs text-slate-500">sur la page affichée</p> }
        </div>
        <div class="rounded-2xl border border-noir-600 bg-noir-800/60 p-5">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Mois impayés</p>
          <p class="mt-2 text-3xl font-extrabold text-white">{{ page()?.total ?? 0 }}</p>
        </div>
        <div class="rounded-2xl border border-noir-600 bg-noir-800/60 p-5">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Locataires concernés</p>
          <p class="mt-2 text-3xl font-extrabold text-white">{{ nbLocataires() }}</p>
        </div>
      </div>

      @if (notification()) {
        <div class="mt-6 flex items-start justify-between gap-4 rounded-xl border border-neon-bleu/50 bg-neon-bleu/10 px-4 py-3 text-sm text-neon-bleu">
          <span>{{ notification() }}</span>
          <button (click)="notification.set(null)" class="text-lg leading-none hover:text-white">×</button>
        </div>
      }
      @if (erreur()) {
        <div class="mt-6 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">{{ erreur() }}</div>
      }

      <input type="search" placeholder="Rechercher : locataire, n° de bail…"
             (input)="recherche$.next($any($event.target).value)"
             class="mt-6 w-full rounded-xl border border-noir-600 bg-noir-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-rouge focus:glow-rouge" />

      <!-- Liste -->
      <div class="mt-6 space-y-3">
        @if (chargement()) {
          @for (i of [1, 2, 3]; track i) { <div class="h-24 animate-pulse rounded-2xl bg-noir-800"></div> }
        } @else {
          @for (e of page()?.data ?? []; track e.id) {
            @let jours = joursRetard(e.date_limite);
            <div class="flex flex-wrap items-center gap-4 rounded-2xl border bg-noir-800/60 p-5 transition hover:bg-noir-700/60"
                 [class]="jours > 30 ? 'border-neon-rouge/70' : 'border-noir-600'">

              <!-- Pastille jours de retard -->
              <div class="grid h-16 w-16 shrink-0 place-items-center rounded-xl border text-center"
                   [class]="jours > 30 ? 'border-neon-rouge bg-neon-rouge/15 glow-rouge' : 'border-neon-rouge/50 bg-neon-rouge/5'">
                <div>
                  <p class="text-xl font-extrabold leading-none text-neon-rouge">{{ jours }}</p>
                  <p class="mt-1 text-[10px] uppercase text-slate-400">jour{{ jours > 1 ? 's' : '' }}</p>
                </div>
              </div>

              <div class="min-w-48 flex-1">
                <p class="font-semibold text-white">{{ e.locataire?.prenom }} {{ e.locataire?.nom }}</p>
                @if ($any(e.locataire)?.telephone; as tel) {
                  <a [href]="'tel:' + tel" class="text-sm text-neon-bleu hover:underline">{{ tel }}</a>
                }
                <p class="text-xs text-slate-500">{{ e.bien?.titre }} · {{ e.bail?.numero }}</p>
              </div>

              <div class="min-w-36">
                <p class="capitalize text-slate-300">{{ nomMois(e.mois) }}</p>
                <p class="text-xs text-neon-rouge">limite : {{ date(e.date_limite) }}</p>
                @if (e.statut === 'partielle') { <p class="text-xs text-amber-300">Partiellement payée</p> }
              </div>

              <div class="min-w-36 text-right">
                <p class="text-lg font-extrabold text-white">{{ montant(e.reste_du) }}</p>
                @if (+e.en_attente > 0) { <p class="text-xs text-amber-300">dont {{ montant(e.en_attente) }} en attente</p> }
              </div>

              <button (click)="echeanceChoisie.set(e)"
                      class="rounded-xl bg-neon-rouge px-4 py-2.5 text-sm font-bold text-white transition hover:glow-rouge">
                Encaisser
              </button>
            </div>
          } @empty {
            <div class="rounded-2xl border border-emerald-400/40 bg-emerald-400/5 px-5 py-14 text-center">
              <p class="text-4xl">✅</p>
              <p class="mt-3 font-semibold text-emerald-300">Aucun impayé : tous les loyers échus sont réglés.</p>
            </div>
          }
        }
      </div>

      @if (page(); as pg) { @if (pg.last_page > 1) {
        <div class="mt-4 flex justify-end gap-2 text-sm text-slate-400">
          <button (click)="charger(pg.current_page - 1)" [disabled]="pg.current_page === 1" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">← Précédent</button>
          <span class="px-2 py-1.5">Page {{ pg.current_page }} / {{ pg.last_page }}</span>
          <button (click)="charger(pg.current_page + 1)" [disabled]="pg.current_page === pg.last_page" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">Suivant →</button>
        </div>
      } }
    </div>
  </div>

  @if (echeanceChoisie(); as e) {
    <app-paiement-form [echeance]="e" (ferme)="echeanceChoisie.set(null)" (enregistre)="apresEnregistrement($event)" />
  }
  `,
})
export class Impayes implements OnInit {
    private service = inject(PaiementService);
    private destroyRef = inject(DestroyRef);

    page = signal<Page<EcheanceAEncaisser> | null>(null);
    chargement = signal(true);
    notification = signal<string | null>(null);
    erreur = signal<string | null>(null);
    echeanceChoisie = signal<EcheanceAEncaisser | null>(null);

    private texte = '';
    recherche$ = new Subject<string>();

    totalRetard = computed(() =>
        (this.page()?.data ?? []).reduce((s, e) => s + (Number(e.reste_du) || 0), 0));

    nbLocataires = computed(() =>
        new Set((this.page()?.data ?? []).map((e) => `${e.locataire?.prenom} ${e.locataire?.nom}`)).size);

    ngOnInit(): void {
        this.recherche$
            .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
            .subscribe((t) => { this.texte = t; this.charger(1); });
        this.charger(1);
    }

    charger(numero: number): void {
        this.chargement.set(true);
        this.service.echeances(numero, this.texte, true).subscribe({
            next: (r) => { this.page.set(r); this.chargement.set(false); },
            error: () => { this.erreur.set('Chargement impossible.'); this.chargement.set(false); },
        });
    }

    apresEnregistrement(message: string): void {
        this.echeanceChoisie.set(null);
        this.notification.set(message + ' Pensez à le valider dans « Paiements → À valider ».');
        this.charger(1);
    }

    // ----- Affichage -----

    joursRetard(limite: string): number {
        const diff = Date.now() - new Date(limite + 'T23:59:59').getTime();
        return Math.max(1, Math.floor(diff / 86_400_000));
    }
    nomMois(v: string): string {
        return new Date(v + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
    date(v: string): string {
        return new Date(v).toLocaleDateString('fr-FR');
    }
    montant(v: string | number): string {
        return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v) || 0) + ' FCFA';
    }
}