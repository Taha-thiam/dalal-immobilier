import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { PaiementService } from '../../core/services/paiement.service';
import {
    EcheanceAEncaisser, MODES_PAIEMENT, ModePaiement, Paiement, STATUTS_PAIEMENT, StatutPaiement,
} from '../../core/models/paiement.model';
import { Page } from '../../core/models/pagination.model';
import { PaiementForm } from './paiement-form';

type Onglet = 'encaisser' | 'valider' | 'historique';

@Component({
    selector: 'app-paiements',
    standalone: true,
    imports: [FormsModule, PaiementForm],
    template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-7xl">

      <h1 class="text-3xl font-extrabold text-white">Paiements</h1>
      <p class="mt-1 text-slate-400">Encaisser les loyers, valider les paiements, émettre les quittances.</p>

      <!-- Onglets -->
      <div class="mt-6 flex gap-2 overflow-x-auto border-b border-noir-600">
        @for (o of onglets; track o.cle) {
          <button (click)="changerOnglet(o.cle)"
                  class="-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition"
                  [class]="onglet() === o.cle ? 'border-neon-bleu text-neon-bleu text-glow-bleu' : 'border-transparent text-slate-400 hover:text-white'">
            {{ o.libelle }}
          </button>
        }
      </div>

      <!-- Messages -->
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

      <!-- Recherche + filtre -->
      <div class="mt-6 flex flex-wrap gap-3">
        <input type="search" placeholder="Rechercher : locataire, n° de bail, référence…"
               (input)="recherche$.next($any($event.target).value)" [class]="champ + ' flex-1 min-w-64'" />
        @if (onglet() === 'valider') {
          <select [(ngModel)]="statutAValider" (ngModelChange)="charger(1)" [class]="champ">
            <option value="enregistre">Saisis par le comptable</option>
            <option value="declare">Déclarés par les locataires</option>
          </select>
        }
        @if (onglet() === 'historique') {
          <select [(ngModel)]="statutHistorique" (ngModelChange)="charger(1)" [class]="champ">
            <option value="">Tous les statuts</option>
            <option value="valide">Validés</option>
            <option value="annule">Annulés</option>
            <option value="enregistre">À valider</option>
          </select>
        }
      </div>

      <!-- ================= Onglet « À encaisser » ================= -->
      @if (onglet() === 'encaisser') {
        <div class="mt-6 overflow-x-auto rounded-2xl border border-noir-600 bg-noir-800/60">
          <table class="w-full min-w-[860px] text-left text-sm">
            <thead class="border-b border-noir-600 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th class="px-5 py-4">Locataire</th>
                <th class="px-5 py-4">Mois</th>
                <th class="px-5 py-4">Échéance</th>
                <th class="px-5 py-4 text-right">Reste dû</th>
                <th class="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              @if (chargement()) {
                <tr><td colspan="5" class="px-5 py-6"><div class="h-5 animate-pulse rounded bg-noir-700"></div></td></tr>
              } @else {
                @for (e of echeances()?.data ?? []; track e.id) {
                  <tr class="border-b border-noir-700 transition hover:bg-noir-700/50">
                    <td class="px-5 py-4">
                      <p class="font-semibold text-white">{{ e.locataire?.prenom }} {{ e.locataire?.nom }}</p>
                      <p class="text-xs text-slate-500">{{ e.bien?.titre }} · {{ e.bail?.numero }}</p>
                    </td>
                    <td class="px-5 py-4 capitalize text-slate-300">{{ nomMois(e.mois) }}</td>
                    <td class="px-5 py-4">
                      <p [class]="e.en_retard ? 'font-semibold text-neon-rouge' : 'text-slate-400'">{{ date(e.date_limite) }}</p>
                      @if (e.en_retard) { <p class="text-xs font-semibold uppercase text-neon-rouge animate-neon">En retard</p> }
                      @else if (e.statut === 'partielle') { <p class="text-xs text-amber-300">Partiellement payée</p> }
                    </td>
                    <td class="px-5 py-4 text-right">
                      <p class="font-bold text-white">{{ montant(e.reste_du) }}</p>
                      @if (+e.en_attente > 0) { <p class="text-xs text-amber-300">dont {{ montant(e.en_attente) }} en attente</p> }
                    </td>
                    <td class="px-5 py-4 text-right">
                      <button (click)="echeanceChoisie.set(e)"
                              class="rounded-xl bg-neon-bleu px-4 py-2 text-sm font-bold text-noir-950 transition hover:glow-bleu">
                        Encaisser
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="px-5 py-12 text-center text-slate-500">Tout est encaissé. 🎉</td></tr>
                }
              }
            </tbody>
          </table>
        </div>
        @if (echeances(); as pg) { @if (pg.last_page > 1) {
          <div class="mt-4 flex justify-end gap-2 text-sm text-slate-400">
            <button (click)="charger(pg.current_page - 1)" [disabled]="pg.current_page === 1" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">← Précédent</button>
            <span class="px-2 py-1.5">Page {{ pg.current_page }} / {{ pg.last_page }}</span>
            <button (click)="charger(pg.current_page + 1)" [disabled]="pg.current_page === pg.last_page" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">Suivant →</button>
          </div>
        } }
      }

      <!-- ================= Onglets « À valider » et « Historique » ================= -->
      @if (onglet() !== 'encaisser') {
        <div class="mt-6 overflow-x-auto rounded-2xl border border-noir-600 bg-noir-800/60">
          <table class="w-full min-w-[960px] text-left text-sm">
            <thead class="border-b border-noir-600 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th class="px-5 py-4">Locataire</th>
                <th class="px-5 py-4">Mois</th>
                <th class="px-5 py-4">Paiement</th>
                <th class="px-5 py-4 text-right">Montant</th>
                <th class="px-5 py-4">Statut</th>
                <th class="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @if (chargement()) {
                <tr><td colspan="6" class="px-5 py-6"><div class="h-5 animate-pulse rounded bg-noir-700"></div></td></tr>
              } @else {
                @for (p of paiements()?.data ?? []; track p.id) {
                  <tr class="border-b border-noir-700 transition hover:bg-noir-700/50">
                    <td class="px-5 py-4">
                      <p class="font-semibold text-white">{{ p.locataire?.prenom }} {{ p.locataire?.nom }}</p>
                      <p class="text-xs text-slate-500">{{ p.bien?.titre }} · {{ p.bail?.numero }}</p>
                    </td>
                    <td class="px-5 py-4 capitalize text-slate-300">{{ p.echeance ? nomMois(p.echeance.mois) : '—' }}</td>
                    <td class="px-5 py-4">
                      <p class="text-slate-300">{{ libelleMode(p.mode_paiement) }} · {{ date(p.date_paiement) }}</p>
                      <p class="font-mono text-xs text-slate-500">{{ p.reference || 'sans référence' }}</p>
                    </td>
                    <td class="px-5 py-4 text-right font-bold text-white">{{ montant(p.montant) }}</td>
                    <td class="px-5 py-4">
                      <span class="rounded-full border px-3 py-1 text-xs font-semibold" [class]="classeStatut(p.statut)">{{ libelleStatut(p.statut) }}</span>
                      @if (p.quittance) { <p class="mt-1.5 font-mono text-xs text-emerald-300">{{ p.quittance.numero }}</p> }
                      @if (p.motif_annulation) { <p class="mt-1.5 max-w-48 text-xs text-slate-500">« {{ p.motif_annulation }} »</p> }
                    </td>
                    <td class="px-5 py-4 text-right">
                      <div class="flex justify-end gap-1">
                        @if (p.statut === 'enregistre' || p.statut === 'declare') {
                          <button (click)="valider(p)" [disabled]="actionEnCours() === p.id"
                                  class="rounded-lg bg-emerald-400/90 px-3 py-1.5 text-sm font-bold text-noir-950 transition hover:bg-emerald-300 disabled:opacity-50">
                            {{ actionEnCours() === p.id ? '…' : 'Valider' }}
                          </button>
                        }
                        @if (p.quittance) {
                          <button (click)="voirQuittance(p)" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-neon-bleu transition hover:bg-neon-bleu/10">Quittance</button>
                        }
                        @if (p.statut !== 'annule') {
                          <button (click)="aAnnuler.set(p)" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-neon-rouge transition hover:bg-neon-rouge/10">Annuler</button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="px-5 py-12 text-center text-slate-500">
                    {{ onglet() === 'valider' ? 'Aucun paiement en attente de validation.' : 'Aucun paiement trouvé.' }}
                  </td></tr>
                }
              }
            </tbody>
          </table>
        </div>
        @if (paiements(); as pg) { @if (pg.last_page > 1) {
          <div class="mt-4 flex justify-end gap-2 text-sm text-slate-400">
            <button (click)="charger(pg.current_page - 1)" [disabled]="pg.current_page === 1" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">← Précédent</button>
            <span class="px-2 py-1.5">Page {{ pg.current_page }} / {{ pg.last_page }}</span>
            <button (click)="charger(pg.current_page + 1)" [disabled]="pg.current_page === pg.last_page" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">Suivant →</button>
          </div>
        } }
      }
    </div>
  </div>

  <!-- Fenêtre d'encaissement -->
  @if (echeanceChoisie(); as e) {
    <app-paiement-form [echeance]="e" (ferme)="echeanceChoisie.set(null)" (enregistre)="apresEnregistrement($event)" />
  }

  <!-- Fenêtre d'annulation (motif obligatoire) -->
  @if (aAnnuler(); as p) {
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="fermerAnnulation()">
      <div class="w-full max-w-md rounded-2xl border border-neon-rouge/50 bg-noir-800 p-6 glow-rouge" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-white">Annuler ce paiement ?</h2>
        <p class="mt-2 text-sm text-slate-400">
          {{ montant(p.montant) }} de {{ p.locataire?.prenom }} {{ p.locataire?.nom }} ({{ libelleMode(p.mode_paiement) }}).
          @if (p.statut === 'valide') { <br><span class="text-neon-rouge">Ce paiement est validé : le mois redeviendra dû et sa quittance sera retirée.</span> }
        </p>
        <label class="mt-4 block text-sm font-medium text-slate-300" for="motif">Motif de l'annulation *</label>
        <textarea id="motif" rows="3" [(ngModel)]="motif" placeholder="Ex. : fonds non reçus sur le compte Wave"
                  [class]="champ + ' mt-1.5 w-full'"></textarea>
        @if (erreurAnnulation()) { <p class="mt-2 text-sm text-neon-rouge">{{ erreurAnnulation() }}</p> }
        <div class="mt-6 flex justify-end gap-3">
          <button (click)="fermerAnnulation()" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 hover:bg-noir-700">Retour</button>
          <button (click)="confirmerAnnulation(p)" [disabled]="actionEnCours() === p.id"
                  class="rounded-xl bg-neon-rouge px-5 py-2.5 font-bold text-white hover:glow-rouge disabled:opacity-60">Annuler le paiement</button>
        </div>
      </div>
    </div>
  }
  `,
})
export class Paiements implements OnInit {
    private service = inject(PaiementService);
    private destroyRef = inject(DestroyRef);

    onglets: { cle: Onglet; libelle: string }[] = [
        { cle: 'encaisser', libelle: 'À encaisser' },
        { cle: 'valider', libelle: 'À valider' },
        { cle: 'historique', libelle: 'Historique' },
    ];
    onglet = signal<Onglet>('encaisser');

    echeances = signal<Page<EcheanceAEncaisser> | null>(null);
    paiements = signal<Page<Paiement> | null>(null);
    chargement = signal(true);
    notification = signal<string | null>(null);
    erreur = signal<string | null>(null);
    actionEnCours = signal<number | null>(null);

    echeanceChoisie = signal<EcheanceAEncaisser | null>(null);
    aAnnuler = signal<Paiement | null>(null);
    erreurAnnulation = signal<string | null>(null);
    motif = '';

    statutAValider: StatutPaiement = 'enregistre';
    statutHistorique: StatutPaiement | '' = '';
    private texte = '';
    recherche$ = new Subject<string>();

    champ = 'rounded-xl border border-noir-600 bg-noir-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

    ngOnInit(): void {
        this.recherche$
            .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
            .subscribe((t) => { this.texte = t; this.charger(1); });
        this.charger(1);
    }

    changerOnglet(o: Onglet): void {
        this.onglet.set(o);
        this.charger(1);
    }

    charger(page: number): void {
        this.chargement.set(true);
        const fin = { error: () => { this.erreur.set('Chargement impossible.'); this.chargement.set(false); } };

        if (this.onglet() === 'encaisser') {
            this.service.echeances(page, this.texte).subscribe({
                next: (r) => { this.echeances.set(r); this.chargement.set(false); }, ...fin,
            });
        } else {
            const statut = this.onglet() === 'valider' ? this.statutAValider : this.statutHistorique;
            this.service.lister(page, statut, this.texte).subscribe({
                next: (r) => { this.paiements.set(r); this.chargement.set(false); }, ...fin,
            });
        }
    }

    apresEnregistrement(message: string): void {
        this.echeanceChoisie.set(null);
        this.notification.set(message);
        this.changerOnglet('valider'); // le paiement attend maintenant sa validation
    }

    valider(p: Paiement): void {
        this.actionEnCours.set(p.id);
        this.erreur.set(null);
        this.service.valider(p.id).subscribe({
            next: (r) => { this.actionEnCours.set(null); this.notification.set(r.message); this.charger(1); },
            error: (e: HttpErrorResponse) => { this.actionEnCours.set(null); this.erreur.set(this.messageErreur(e)); },
        });
    }

    fermerAnnulation(): void {
        this.aAnnuler.set(null);
        this.motif = '';
        this.erreurAnnulation.set(null);
    }

    confirmerAnnulation(p: Paiement): void {
        this.actionEnCours.set(p.id);
        this.service.annuler(p.id, this.motif.trim()).subscribe({
            next: (r) => { this.actionEnCours.set(null); this.fermerAnnulation(); this.notification.set(r.message); this.charger(1); },
            error: (e: HttpErrorResponse) => { this.actionEnCours.set(null); this.erreurAnnulation.set(this.messageErreur(e)); },
        });
    }

    voirQuittance(p: Paiement): void {
        this.service.telechargerQuittance(p.id).subscribe({
            next: (fichier) => {
                const url = URL.createObjectURL(fichier);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 60_000);
            },
            error: () => this.erreur.set('Quittance introuvable.'),
        });
    }

    private messageErreur(e: HttpErrorResponse): string {
        const erreurs = e.error?.errors as Record<string, string[]> | undefined;
        if (erreurs) return Object.values(erreurs)[0]?.[0] ?? 'Données invalides.';
        return e.error?.message ?? 'Une erreur est survenue.';
    }

    // ----- Affichage -----

    nomMois(v: string): string {
        return new Date(v + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
    date(v: string): string {
        return new Date(v).toLocaleDateString('fr-FR');
    }
    montant(v: string | number): string {
        return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v) || 0) + ' FCFA';
    }
    libelleMode(m: ModePaiement): string {
        return MODES_PAIEMENT.find((x) => x.valeur === m)?.libelle ?? m;
    }
    libelleStatut(s: StatutPaiement): string {
        return STATUTS_PAIEMENT[s];
    }
    classeStatut(s: StatutPaiement): string {
        switch (s) {
            case 'valide': return 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300';
            case 'annule': return 'border-slate-500/60 text-slate-500 line-through';
            case 'declare': return 'border-neon-bleu/60 bg-neon-bleu/10 text-neon-bleu';
            default: return 'border-amber-300/60 bg-amber-300/10 text-amber-300';
        }
    }
}