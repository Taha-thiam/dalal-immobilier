import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ReversementService } from '../../core/services/reversement.service';
import {
    Apercu, LigneApercu, Reversement, STATUTS_REVERSEMENT, StatutReversement,
} from '../../core/models/reversement.model';
import { MODES_PAIEMENT } from '../../core/models/paiement.model';
import { Page } from '../../core/models/pagination.model';

type Onglet = 'apercu' | 'historique';

@Component({
    selector: 'app-reversements',
    standalone: true,
    imports: [FormsModule],
    template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-7xl">

      <h1 class="text-3xl font-extrabold text-white">Reversements</h1>
      <p class="mt-1 text-slate-400">Reverser aux propriétaires les loyers encaissés, moins la commission de l'agence.</p>

      <!-- Onglets -->
      <div class="mt-6 flex gap-2 border-b border-noir-600">
        @for (o of onglets; track o.cle) {
          <button (click)="changerOnglet(o.cle)"
                  class="-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition"
                  [class]="onglet() === o.cle ? 'border-neon-bleu text-neon-bleu text-glow-bleu' : 'border-transparent text-slate-400 hover:text-white'">
            {{ o.libelle }}
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
        <div class="mt-6 flex items-start justify-between gap-4 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">
          <span>{{ erreur() }}</span>
          <button (click)="erreur.set(null)" class="text-lg leading-none hover:text-white">×</button>
        </div>
      }

      <!-- ================= Onglet « À reverser » ================= -->
      @if (onglet() === 'apercu') {
        <div class="mt-6 flex flex-wrap items-end gap-3">
          <label class="text-sm text-slate-300">Loyers encaissés jusqu'au
            <input type="date" [(ngModel)]="jusquau" (ngModelChange)="chargerApercu()" [max]="aujourdhui" [class]="champ + ' mt-1.5 block'" />
          </label>
        </div>

        @if (apercu(); as a) {
          <div class="mt-6 grid gap-4 sm:grid-cols-3">
            <div class="rounded-2xl border border-noir-600 bg-noir-800/60 p-5">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Loyers encaissés</p>
              <p class="mt-2 text-2xl font-extrabold text-white">{{ montant(a.total_brut) }}</p>
            </div>
            <div class="rounded-2xl border border-neon-rouge/40 bg-neon-rouge/5 p-5">
              <p class="text-xs font-semibold uppercase tracking-wider text-neon-rouge">Commission agence</p>
              <p class="mt-2 text-2xl font-extrabold text-white">{{ montant(a.total_com) }}</p>
            </div>
            <div class="rounded-2xl border border-neon-bleu/50 bg-neon-bleu/5 p-5 glow-bleu">
              <p class="text-xs font-semibold uppercase tracking-wider text-neon-bleu">Net à reverser</p>
              <p class="mt-2 text-2xl font-extrabold text-white">{{ montant(a.total_net) }}</p>
            </div>
          </div>
        }

        <div class="mt-6 space-y-3">
          @if (chargement()) {
            @for (i of [1, 2]; track i) { <div class="h-24 animate-pulse rounded-2xl bg-noir-800"></div> }
          } @else {
            @for (l of apercu()?.lignes ?? []; track l.proprietaire_id) {
              <div class="flex flex-wrap items-center gap-4 rounded-2xl border border-noir-600 bg-noir-800/60 p-5 transition hover:border-neon-bleu/40">
                <div class="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-neon-bleu/50 bg-neon-bleu/10 font-bold text-neon-bleu">
                  {{ l.prenom.charAt(0) }}{{ l.nom.charAt(0) }}
                </div>
                <div class="min-w-48 flex-1">
                  <p class="font-semibold text-white">{{ l.prenom }} {{ l.nom }}</p>
                  <p class="text-xs text-slate-500">{{ l.telephone }} · {{ l.nb_paiements }} loyer{{ l.nb_paiements > 1 ? 's' : '' }}</p>
                </div>
                <div class="text-right text-sm">
                  <p class="text-slate-400">{{ montant(l.montant_brut) }}</p>
                  <p class="text-neon-rouge">− {{ montant(l.commission) }}</p>
                </div>
                <div class="min-w-36 text-right">
                  <p class="text-xs uppercase text-slate-500">Net</p>
                  <p class="text-xl font-extrabold text-neon-bleu text-glow-bleu">{{ montant(l.montant_net) }}</p>
                </div>
                <button (click)="preparer(l)" [disabled]="actionEnCours() === l.proprietaire_id"
                        class="rounded-xl bg-neon-bleu px-4 py-2.5 text-sm font-bold text-noir-950 transition hover:glow-bleu disabled:opacity-50">
                  {{ actionEnCours() === l.proprietaire_id ? '…' : 'Préparer' }}
                </button>
              </div>
            } @empty {
              <div class="rounded-2xl border border-emerald-400/40 bg-emerald-400/5 px-5 py-14 text-center">
                <p class="text-4xl">✅</p>
                <p class="mt-3 font-semibold text-emerald-300">Aucun loyer en attente de reversement à cette date.</p>
              </div>
            }
          }
        </div>
      }

      <!-- ================= Onglet « Historique » ================= -->
      @if (onglet() === 'historique') {
        <div class="mt-6 flex flex-wrap gap-3">
          @for (f of filtres; track f.valeur) {
            <button (click)="statut = f.valeur; chargerHistorique(1)"
                    class="rounded-full border px-4 py-2 text-sm font-semibold transition"
                    [class]="statut === f.valeur ? 'border-neon-bleu bg-neon-bleu/10 text-neon-bleu glow-bleu' : 'border-noir-600 text-slate-400 hover:text-white'">
              {{ f.libelle }}
            </button>
          }
          <input type="search" placeholder="Rechercher : propriétaire, n° REV…"
                 (input)="recherche$.next($any($event.target).value)" [class]="champ + ' min-w-64 flex-1'" />
        </div>

        <div class="mt-6 overflow-x-auto rounded-2xl border border-noir-600 bg-noir-800/60">
          <table class="w-full min-w-[940px] text-left text-sm">
            <thead class="border-b border-noir-600 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th class="px-5 py-4">Reversement</th>
                <th class="px-5 py-4">Propriétaire</th>
                <th class="px-5 py-4 text-right">Brut</th>
                <th class="px-5 py-4 text-right">Commission</th>
                <th class="px-5 py-4 text-right">Net</th>
                <th class="px-5 py-4">Statut</th>
                <th class="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @if (chargement()) {
                <tr><td colspan="7" class="px-5 py-6"><div class="h-5 animate-pulse rounded bg-noir-700"></div></td></tr>
              } @else {
                @for (r of historique()?.data ?? []; track r.id) {
                  <tr class="border-b border-noir-700 transition hover:bg-noir-700/50">
                    <td class="px-5 py-4">
                      <p class="font-mono font-semibold text-white">{{ r.numero }}</p>
                      <p class="text-xs text-slate-500">{{ date(r.periode_debut) }} → {{ date(r.periode_fin) }} · {{ r.paiements_count }} loyer(s)</p>
                    </td>
                    <td class="px-5 py-4 text-slate-300">{{ r.proprietaire?.prenom }} {{ r.proprietaire?.nom }}</td>
                    <td class="px-5 py-4 text-right text-slate-400">{{ montant(r.montant_brut) }}</td>
                    <td class="px-5 py-4 text-right text-neon-rouge">− {{ montant(r.commission) }}</td>
                    <td class="px-5 py-4 text-right font-bold text-white">{{ montant(r.montant_net) }}</td>
                    <td class="px-5 py-4">
                      <span class="rounded-full border px-3 py-1 text-xs font-semibold" [class]="statuts[r.statut].classe">{{ statuts[r.statut].libelle }}</span>
                      @if (r.statut === 'paye') {
                        <p class="mt-1.5 text-xs text-slate-500">{{ date(r.date_paiement) }} · {{ libelleMode(r.mode_paiement) }}</p>
                        @if (r.reference) { <p class="font-mono text-xs text-slate-500">{{ r.reference }}</p> }
                      }
                    </td>
                    <td class="px-5 py-4 text-right">
                      <div class="flex justify-end gap-1">
                        @if (r.statut === 'a_payer') {
                          <button (click)="ouvrirPaiement(r)" class="rounded-lg bg-emerald-400/90 px-3 py-1.5 text-sm font-bold text-noir-950 hover:bg-emerald-300">Payer</button>
                        }
                        <button (click)="voirReleve(r)" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-neon-bleu hover:bg-neon-bleu/10">Relevé</button>
                        @if (r.statut === 'a_payer') {
                          <button (click)="aSupprimer.set(r)" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-neon-rouge hover:bg-neon-rouge/10">Supprimer</button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="px-5 py-12 text-center text-slate-500">Aucun reversement.</td></tr>
                }
              }
            </tbody>
          </table>
        </div>

        @if (historique(); as pg) { @if (pg.last_page > 1) {
          <div class="mt-4 flex justify-end gap-2 text-sm text-slate-400">
            <button (click)="chargerHistorique(pg.current_page - 1)" [disabled]="pg.current_page === 1" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">← Précédent</button>
            <span class="px-2 py-1.5">Page {{ pg.current_page }} / {{ pg.last_page }}</span>
            <button (click)="chargerHistorique(pg.current_page + 1)" [disabled]="pg.current_page === pg.last_page" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">Suivant →</button>
          </div>
        } }
      }
    </div>
  </div>

  <!-- Fenêtre « Payer » -->
  @if (aPayer(); as r) {
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="aPayer.set(null)">
      <div class="w-full max-w-md rounded-2xl border border-emerald-400/50 bg-noir-800 p-6" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-white">Payer {{ r.numero }}</h2>
        <p class="mt-1 text-sm text-slate-400">
          Verser <span class="font-bold text-emerald-300">{{ montant(r.montant_net) }}</span>
          à {{ r.proprietaire?.prenom }} {{ r.proprietaire?.nom }}.
        </p>
        <div class="mt-5 grid gap-4">
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm text-slate-300">Date *
              <input type="date" [(ngModel)]="formPaiement.date" [max]="aujourdhui" [class]="champ + ' mt-1.5 w-full'" />
            </label>
            <label class="block text-sm text-slate-300">Mode *
              <select [(ngModel)]="formPaiement.mode" [class]="champ + ' mt-1.5 w-full'">
                @for (m of modes; track m.valeur) { <option [value]="m.valeur">{{ m.libelle }}</option> }
              </select>
            </label>
          </div>
          <label class="block text-sm text-slate-300">
            Référence {{ formPaiement.mode !== 'especes' ? '*' : '(facultatif)' }}
            <input type="text" [(ngModel)]="formPaiement.reference" placeholder="Ex. : WV-REV-001" [class]="champ + ' mt-1.5 w-full'" />
          </label>
          @if (erreurFenetre()) { <p class="text-sm text-neon-rouge">{{ erreurFenetre() }}</p> }
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button (click)="aPayer.set(null)" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 hover:bg-noir-700">Annuler</button>
          <button (click)="confirmerPaiement(r)" [disabled]="actionEnCours() === r.id"
                  class="rounded-xl bg-emerald-400 px-5 py-2.5 font-bold text-noir-950 hover:bg-emerald-300 disabled:opacity-60">
            {{ actionEnCours() === r.id ? 'Envoi…' : 'Confirmer le paiement' }}
          </button>
        </div>
      </div>
    </div>
  }

  <!-- Fenêtre « Supprimer » -->
  @if (aSupprimer(); as r) {
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="aSupprimer.set(null)">
      <div class="w-full max-w-md rounded-2xl border border-neon-rouge/50 bg-noir-800 p-6 glow-rouge" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-white">Supprimer {{ r.numero }} ?</h2>
        <p class="mt-2 text-sm text-slate-400">Les {{ r.paiements_count }} loyer(s) inclus redeviendront « à reverser ».</p>
        <div class="mt-6 flex justify-end gap-3">
          <button (click)="aSupprimer.set(null)" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 hover:bg-noir-700">Retour</button>
          <button (click)="confirmerSuppression(r)" class="rounded-xl bg-neon-rouge px-5 py-2.5 font-bold text-white hover:glow-rouge">Supprimer</button>
        </div>
      </div>
    </div>
  }
  `,
})
export class Reversements implements OnInit {
    private service = inject(ReversementService);
    private destroyRef = inject(DestroyRef);

    onglets: { cle: Onglet; libelle: string }[] = [
        { cle: 'apercu', libelle: 'À reverser' },
        { cle: 'historique', libelle: 'Historique' },
    ];
    filtres: { valeur: StatutReversement | ''; libelle: string }[] = [
        { valeur: '', libelle: 'Tous' },
        { valeur: 'a_payer', libelle: 'À payer' },
        { valeur: 'paye', libelle: 'Payés' },
    ];
    statuts = STATUTS_REVERSEMENT;
    modes = MODES_PAIEMENT;

    onglet = signal<Onglet>('apercu');
    apercu = signal<Apercu | null>(null);
    historique = signal<Page<Reversement> | null>(null);
    chargement = signal(true);
    notification = signal<string | null>(null);
    erreur = signal<string | null>(null);
    actionEnCours = signal<number | null>(null);

    aPayer = signal<Reversement | null>(null);
    aSupprimer = signal<Reversement | null>(null);
    erreurFenetre = signal<string | null>(null);

    aujourdhui = new Date().toISOString().slice(0, 10);
    jusquau = this.aujourdhui;
    statut: StatutReversement | '' = '';
    private texte = '';
    recherche$ = new Subject<string>();
    formPaiement = { date: this.aujourdhui, mode: 'wave', reference: '' };

    champ = 'rounded-xl border border-noir-600 bg-noir-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

    ngOnInit(): void {
        this.recherche$
            .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
            .subscribe((t) => { this.texte = t; this.chargerHistorique(1); });
        this.chargerApercu();
    }

    changerOnglet(o: Onglet): void {
        this.onglet.set(o);
        o === 'apercu' ? this.chargerApercu() : this.chargerHistorique(1);
    }

    chargerApercu(): void {
        this.chargement.set(true);
        this.service.apercu(this.jusquau).subscribe({
            next: (a) => { this.apercu.set(a); this.chargement.set(false); },
            error: () => { this.erreur.set('Chargement impossible.'); this.chargement.set(false); },
        });
    }

    chargerHistorique(page: number): void {
        this.chargement.set(true);
        this.service.lister(page, this.statut, this.texte).subscribe({
            next: (p) => { this.historique.set(p); this.chargement.set(false); },
            error: () => { this.erreur.set('Chargement impossible.'); this.chargement.set(false); },
        });
    }

    preparer(l: LigneApercu): void {
        this.actionEnCours.set(l.proprietaire_id);
        this.erreur.set(null);
        this.service.creer(l.proprietaire_id, this.jusquau).subscribe({
            next: (r) => {
                this.actionEnCours.set(null);
                this.notification.set(r.message);
                this.statut = 'a_payer';
                this.changerOnglet('historique'); // il attend maintenant d'être payé
            },
            error: (e: HttpErrorResponse) => { this.actionEnCours.set(null); this.erreur.set(this.messageErreur(e)); },
        });
    }

    ouvrirPaiement(r: Reversement): void {
        this.formPaiement = { date: this.aujourdhui, mode: 'wave', reference: '' };
        this.erreurFenetre.set(null);
        this.aPayer.set(r);
    }

    confirmerPaiement(r: Reversement): void {
        this.actionEnCours.set(r.id);
        this.service.payer(r.id, { ...this.formPaiement, reference: this.formPaiement.reference.trim() || null }).subscribe({
            next: (res) => {
                this.actionEnCours.set(null);
                this.aPayer.set(null);
                this.notification.set(res.message);
                this.chargerHistorique(this.historique()?.current_page ?? 1);
            },
            error: (e: HttpErrorResponse) => { this.actionEnCours.set(null); this.erreurFenetre.set(this.messageErreur(e)); },
        });
    }

    confirmerSuppression(r: Reversement): void {
        this.service.supprimer(r.id).subscribe({
            next: (res) => { this.aSupprimer.set(null); this.notification.set(res.message); this.chargerHistorique(1); },
            error: (e: HttpErrorResponse) => { this.aSupprimer.set(null); this.erreur.set(this.messageErreur(e)); },
        });
    }

    voirReleve(r: Reversement): void {
        this.service.telechargerReleve(r.id).subscribe({
            next: (fichier) => {
                const url = URL.createObjectURL(fichier);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 60_000);
            },
            error: () => {
                // Relevé absent : on le régénère puis on réessaie une fois
                this.service.regenererReleve(r.id).subscribe({
                    next: () => this.voirReleve(r),
                    error: () => this.erreur.set('Relevé introuvable.'),
                });
            },
        });
    }

    private messageErreur(e: HttpErrorResponse): string {
        const erreurs = e.error?.errors as Record<string, string[]> | undefined;
        if (erreurs) return Object.values(erreurs)[0]?.[0] ?? 'Données invalides.';
        return e.error?.message ?? 'Une erreur est survenue.';
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