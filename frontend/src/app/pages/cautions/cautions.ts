import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { CautionService } from '../../core/services/caution.service';
import { Caution, STATUTS_CAUTION, StatutCaution } from '../../core/models/caution.model';
import { MODES_PAIEMENT } from '../../core/models/paiement.model';
import { Page } from '../../core/models/pagination.model';

type Fenetre = { type: 'encaisser' | 'restituer'; caution: Caution } | null;

@Component({
  selector: 'app-cautions',
  standalone: true,
  imports: [FormsModule],
  template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-7xl">

      <h1 class="text-3xl font-extrabold text-white">Cautions</h1>
      <p class="mt-1 text-slate-400">Encaisser la caution à l'entrée, la restituer à la sortie.</p>

      <!-- Filtres -->
      <div class="mt-6 flex flex-wrap gap-2">
        @for (f of filtres; track f.valeur) {
          <button (click)="filtrer(f.valeur)"
                  class="rounded-full border px-4 py-2 text-sm font-semibold transition"
                  [class]="statut === f.valeur ? 'border-neon-bleu bg-neon-bleu/10 text-neon-bleu glow-bleu' : 'border-noir-600 text-slate-400 hover:text-white'">
            {{ f.libelle }}
          </button>
        }
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
             (input)="recherche$.next($any($event.target).value)" [class]="champ + ' mt-6 w-full'" />

      <!-- Tableau -->
      <div class="mt-6 overflow-x-auto rounded-2xl border border-noir-600 bg-noir-800/60">
        <table class="w-full min-w-[900px] text-left text-sm">
          <thead class="border-b border-noir-600 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th class="px-5 py-4">Locataire</th>
              <th class="px-5 py-4">Bail</th>
              <th class="px-5 py-4 text-right">Montant</th>
              <th class="px-5 py-4">Statut</th>
              <th class="px-5 py-4">Détail</th>
              <th class="px-5 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            @if (chargement()) {
              <tr><td colspan="6" class="px-5 py-6"><div class="h-5 animate-pulse rounded bg-noir-700"></div></td></tr>
            } @else {
              @for (c of page()?.data ?? []; track c.id) {
                <tr class="border-b border-noir-700 transition hover:bg-noir-700/50">
                  <td class="px-5 py-4">
                    <p class="font-semibold text-white">{{ c.locataire?.prenom }} {{ c.locataire?.nom }}</p>
                    <p class="text-xs text-slate-500">{{ c.locataire?.telephone }}</p>
                  </td>
                  <td class="px-5 py-4">
                    <p class="font-mono text-slate-300">{{ c.bail?.numero }}</p>
                    <p class="text-xs text-slate-500">{{ c.bien?.titre }}</p>
                  </td>
                  <td class="px-5 py-4 text-right font-bold text-white">{{ montant(c.montant) }}</td>
                  <td class="px-5 py-4">
                    <span class="rounded-full border px-3 py-1 text-xs font-semibold" [class]="statuts[c.statut].classe">
                      {{ statuts[c.statut].libelle }}
                    </span>
                  </td>
                  <td class="px-5 py-4 text-xs text-slate-400">
                    @switch (c.statut) {
                      @case ('encaissee') {
                        Reçue le {{ date(c.date_encaissement) }} · {{ libelleMode(c.mode_encaissement) }}
                        @if (c.reference_encaissement) { <br><span class="font-mono">{{ c.reference_encaissement }}</span> }
                      }
                      @case ('restituee') {
                        Rendue le {{ date(c.date_remboursement) }} : <span class="font-semibold text-emerald-300">{{ montant(c.montant_rembourse) }}</span>
                        @if (+c.montant_retenu > 0) {
                          <br><span class="text-neon-rouge">Retenue {{ montant(c.montant_retenu) }}</span> — « {{ c.motif_retenue }} »
                        }
                      }
                      @default { En attente du versement }
                    }
                  </td>
                  <td class="px-5 py-4 text-right">
                    @if (c.statut === 'a_encaisser') {
                      <button (click)="ouvrir('encaisser', c)" class="rounded-xl bg-neon-bleu px-4 py-2 text-sm font-bold text-noir-950 transition hover:glow-bleu">Encaisser</button>
                    } @else if (c.statut === 'encaissee') {
                      <button (click)="ouvrir('restituer', c)" class="rounded-xl border border-emerald-400/70 px-4 py-2 text-sm font-bold text-emerald-300 transition hover:bg-emerald-400/10">Restituer</button>
                    } @else {
                      <span class="text-xs text-slate-600">Clôturée</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="px-5 py-12 text-center text-slate-500">Aucune caution.</td></tr>
              }
            }
          </tbody>
        </table>
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

  <!-- ============ Fenêtre Encaisser / Restituer ============ -->
  @if (fenetre(); as f) {
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="fermer()">
      <div class="w-full max-w-md rounded-2xl border bg-noir-800 p-6"
           [class]="f.type === 'encaisser' ? 'border-neon-bleu/50 glow-bleu' : 'border-emerald-400/50'"
           (click)="$event.stopPropagation()">

        <h2 class="text-lg font-bold text-white">
          {{ f.type === 'encaisser' ? 'Encaisser la caution' : 'Restituer la caution' }}
        </h2>
        <p class="mt-1 text-sm text-slate-400">
          {{ f.caution.locataire?.prenom }} {{ f.caution.locataire?.nom }} · {{ f.caution.bail?.numero }} ·
          <span class="font-semibold text-white">{{ montant(f.caution.montant) }}</span>
        </p>

        <div class="mt-5 grid gap-4">
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm text-slate-300">Date *
              <input type="date" [(ngModel)]="form.date" [max]="aujourdhui" [class]="champ + ' mt-1.5 w-full'" />
            </label>
            <label class="block text-sm text-slate-300">Mode *
              <select [(ngModel)]="form.mode" [class]="champ + ' mt-1.5 w-full'">
                @for (m of modes; track m.valeur) { <option [value]="m.valeur">{{ m.libelle }}</option> }
              </select>
            </label>
          </div>

          @if (f.type === 'encaisser') {
            <label class="block text-sm text-slate-300">
              Référence {{ form.mode !== 'especes' ? '*' : '(facultatif)' }}
              <input type="text" [(ngModel)]="form.reference" placeholder="Ex. : WV-CAU-001" [class]="champ + ' mt-1.5 w-full'" />
            </label>
          } @else {
            <label class="block text-sm text-slate-300">Retenue (FCFA)
              <input type="number" min="0" [max]="+f.caution.montant" [(ngModel)]="form.montant_retenu" [class]="champ + ' mt-1.5 w-full'" />
            </label>
            @if (form.montant_retenu > 0) {
              <label class="block text-sm text-slate-300">Motif de la retenue *
                <textarea rows="2" [(ngModel)]="form.motif_retenue" placeholder="Ex. : vitre de la cuisine cassée (état des lieux de sortie)"
                          [class]="champ + ' mt-1.5 w-full'"></textarea>
              </label>
            }
            <div class="rounded-xl border border-emerald-400/40 bg-emerald-400/5 px-4 py-3 text-sm">
              <span class="text-slate-400">À rendre au locataire :</span>
              <span class="ml-2 text-lg font-extrabold text-emerald-300">{{ montant(aRendre(f.caution)) }}</span>
            </div>
          }

          @if (erreurFenetre()) { <p class="text-sm text-neon-rouge">{{ erreurFenetre() }}</p> }
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button (click)="fermer()" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 hover:bg-noir-700">Annuler</button>
          <button (click)="confirmer(f)" [disabled]="envoi()"
                  class="rounded-xl px-5 py-2.5 font-bold transition disabled:opacity-60"
                  [class]="f.type === 'encaisser' ? 'bg-neon-bleu text-noir-950 hover:glow-bleu' : 'bg-emerald-400 text-noir-950 hover:bg-emerald-300'">
            {{ envoi() ? 'Envoi…' : (f.type === 'encaisser' ? 'Encaisser' : 'Restituer') }}
          </button>
        </div>
      </div>
    </div>
  }
  `,
})
export class Cautions implements OnInit {
  private service = inject(CautionService);
  private destroyRef = inject(DestroyRef);

  statuts = STATUTS_CAUTION;
  modes = MODES_PAIEMENT;
  filtres: { valeur: StatutCaution | ''; libelle: string }[] = [
    { valeur: '', libelle: 'Toutes' },
    { valeur: 'a_encaisser', libelle: 'À encaisser' },
    { valeur: 'encaissee', libelle: 'Encaissées' },
    { valeur: 'restituee', libelle: 'Restituées' },
  ];

  page = signal<Page<Caution> | null>(null);
  chargement = signal(true);
  notification = signal<string | null>(null);
  erreur = signal<string | null>(null);

  fenetre = signal<Fenetre>(null);
  envoi = signal(false);
  erreurFenetre = signal<string | null>(null);

  statut: StatutCaution | '' = '';
  private texte = '';
  recherche$ = new Subject<string>();

  aujourdhui = new Date().toISOString().slice(0, 10);
  form = this.formVide();

  champ = 'rounded-xl border border-noir-600 bg-noir-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

  ngOnInit(): void {
    this.recherche$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((t) => { this.texte = t; this.charger(1); });
    this.charger(1);
  }

  filtrer(s: StatutCaution | ''): void {
    this.statut = s;
    this.charger(1);
  }

  charger(numero: number): void {
    this.chargement.set(true);
    this.service.lister(numero, this.statut, this.texte).subscribe({
      next: (r) => { this.page.set(r); this.chargement.set(false); },
      error: () => { this.erreur.set('Chargement impossible.'); this.chargement.set(false); },
    });
  }

  ouvrir(type: 'encaisser' | 'restituer', caution: Caution): void {
    this.form = this.formVide();

    // Restitution : on reprend la retenue calculée à l'état des lieux de sortie
    if (type === 'restituer') {
      this.form.montant_retenu = Number(caution.montant_retenu) || 0;
      this.form.motif_retenue = caution.motif_retenue ?? '';
    }

    this.erreurFenetre.set(null);
    this.fenetre.set({ type, caution });
  }

  fermer(): void {
    this.fenetre.set(null);
  }

  aRendre(c: Caution): number {
    return Math.max(0, Number(c.montant) - (Number(this.form.montant_retenu) || 0));
  }

  confirmer(f: NonNullable<Fenetre>): void {
    this.envoi.set(true);
    this.erreurFenetre.set(null);

    const requete = f.type === 'encaisser'
      ? this.service.encaisser(f.caution.id, {
        date: this.form.date, mode: this.form.mode, reference: this.form.reference.trim() || null,
      })
      : this.service.restituer(f.caution.id, {
        date: this.form.date, mode: this.form.mode,
        montant_retenu: Number(this.form.montant_retenu) || 0,
        motif_retenue: this.form.motif_retenue.trim() || null,
      });

    requete.subscribe({
      next: (r) => {
        this.envoi.set(false);
        this.fermer();
        this.notification.set(r.message);
        this.charger(this.page()?.current_page ?? 1);
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        const erreurs = e.error?.errors as Record<string, string[]> | undefined;
        this.erreurFenetre.set(erreurs ? Object.values(erreurs)[0]?.[0] : (e.error?.message ?? 'Une erreur est survenue.'));
      },
    });
  }

  private formVide() {
    return { date: new Date().toISOString().slice(0, 10), mode: 'especes', reference: '', montant_retenu: 0, motif_retenue: '' };
  }

  // ----- Affichage -----
  montant(v: string | number | null): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v) || 0) + ' FCFA';
  }
  date(v: string | null): string {
    return v ? new Date(v).toLocaleDateString('fr-FR') : '—';
  }
  libelleMode(m: string | null): string {
    return MODES_PAIEMENT.find((x) => x.valeur === m)?.libelle ?? (m ?? '—');
  }
}