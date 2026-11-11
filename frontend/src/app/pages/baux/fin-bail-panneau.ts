import { Component, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { FinBailService, INITIATIVES, Initiative } from '../../core/services/fin-bail.service';

/** Ce dont le panneau a besoin du bail (le modèle Bail complet convient aussi). */
export interface BailFin {
  id: number;
  statut: string;
  date_debut: string;
  date_fin: string;
  date_resiliation?: string | null;
  motif_resiliation?: string | null;
  loyer_mensuel?: string | number;
  charges?: string | number;
}

@Component({
  selector: 'app-fin-bail-panneau',
  standalone: true,
  imports: [FormsModule],
  template: `
  @let b = bail();

  <section class="rounded-2xl border p-5"
           [class]="b.statut === 'en_preavis' ? 'border-amber-300/50 bg-amber-300/5' : estClos() ? 'border-noir-600 bg-noir-800/40' : 'border-neon-rouge/30 bg-noir-800/60'">

    <h2 class="text-sm font-bold uppercase tracking-wider"
        [class]="b.statut === 'en_preavis' ? 'text-amber-300' : estClos() ? 'text-slate-500' : 'text-neon-rouge'">
      Fin de bail
    </h2>

    @if (notification()) { <p class="mt-3 text-sm text-neon-bleu">{{ notification() }}</p> }
    @if (erreur()) { <p class="mt-3 text-sm text-neon-rouge">{{ erreur() }}</p> }

    @if (estClos()) {
      <p class="mt-3 text-slate-400">
        Ce bail est clos ({{ libelleStatut(b.statut) }}).
        @if (b.date_resiliation) { Sortie le {{ date(b.date_resiliation) }}. }
      </p>
    } @else if (b.statut === 'en_preavis') {
      <p class="mt-3 text-white">
        Sortie prévue le <span class="font-bold text-amber-300">{{ date(b.date_resiliation) }}</span>
      </p>
      @if (b.motif_resiliation) { <p class="mt-1 text-sm text-slate-400">Motif : « {{ b.motif_resiliation }} »</p> }
      <button (click)="ouvrirEdl()" [disabled]="envoi()"
              class="mt-4 rounded-xl bg-neon-rouge px-5 py-2.5 font-bold text-white transition hover:glow-rouge disabled:opacity-50">
        {{ envoi() ? '…' : 'État des lieux de sortie →' }}
      </button>
    } @else {
      <p class="mt-3 text-sm text-slate-400">
        Le locataire reste ? <span class="text-emerald-300">Renouvelez</span>. Il part ? Enregistrez la résiliation, puis faites l'état des lieux de sortie.
      </p>
      <div class="mt-4 flex flex-wrap gap-3">
        <button (click)="ouvrirRenouvellement()"
                class="rounded-xl bg-emerald-400 px-5 py-2.5 font-bold text-noir-950 transition hover:bg-emerald-300">
          ↻ Renouveler
        </button>
        <button (click)="fenetre.set('resiliation')"
                class="rounded-xl border border-neon-rouge/60 px-5 py-2.5 font-semibold text-neon-rouge transition hover:bg-neon-rouge/10">
          Résilier le bail
        </button>
        <button (click)="ouvrirEdl()" [disabled]="envoi()" title="Pour un bail arrivé à son terme normal"
                class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 transition hover:bg-noir-700 disabled:opacity-50">
          État des lieux de sortie
        </button>
      </div>
    }
  </section>

  <!-- ===================== Fenêtre : résiliation ===================== -->
  @if (fenetre() === 'resiliation') {
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="fenetre.set(null)">
      <div class="w-full max-w-md rounded-2xl border border-neon-rouge/50 bg-noir-800 p-6 glow-rouge" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-white">Résilier le bail</h2>
        <p class="mt-1 text-sm text-slate-400">Les mois après la date de sortie, non payés, seront retirés de l'échéancier.</p>

        <div class="mt-5 grid gap-4">
          <label class="text-sm text-slate-300">Date de sortie *
            <input type="date" [(ngModel)]="form.date_effet" [min]="b.date_debut.slice(0, 10)" [max]="b.date_fin.slice(0, 10)" [class]="champ" />
          </label>
          <label class="text-sm text-slate-300">À l'initiative de *
            <select [(ngModel)]="form.initiative" [class]="champ">
              @for (i of initiatives; track i.valeur) { <option [value]="i.valeur">{{ i.libelle }}</option> }
            </select>
          </label>
          <label class="text-sm text-slate-300">Motif *
            <textarea rows="3" [(ngModel)]="form.motif" placeholder="Ex. : mutation professionnelle à Thiès" [class]="champ"></textarea>
          </label>
          @if (erreurFenetre()) { <p class="text-sm text-neon-rouge">{{ erreurFenetre() }}</p> }
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button (click)="fenetre.set(null)" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 hover:bg-noir-700">Annuler</button>
          <button (click)="resilier()" [disabled]="envoi()"
                  class="rounded-xl bg-neon-rouge px-5 py-2.5 font-bold text-white hover:glow-rouge disabled:opacity-60">
            {{ envoi() ? 'Envoi…' : 'Confirmer la résiliation' }}
          </button>
        </div>
      </div>
    </div>
  }

  <!-- ===================== Fenêtre : renouvellement ===================== -->
  @if (fenetre() === 'renouvellement') {
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="fenetre.set(null)">
      <div class="w-full max-w-md rounded-2xl border border-emerald-400/50 bg-noir-800 p-6" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-white">Renouveler le bail</h2>
        <p class="mt-1 text-sm text-slate-400">
          Le nouveau bail commencera le <span class="font-semibold text-emerald-300">{{ lendemain(b.date_fin) }}</span>.
          La caution est conservée et passe sur le nouveau bail.
        </p>

        <div class="mt-5 grid gap-4">
          <label class="text-sm text-slate-300">Durée *
            <select [(ngModel)]="formR.duree_mois" [class]="champ">
              @for (d of [6, 12, 24, 36]; track d) { <option [ngValue]="d">{{ d }} mois</option> }
            </select>
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="text-sm text-slate-300">Nouveau loyer
              <input type="number" min="0" step="5000" [(ngModel)]="formR.loyer_mensuel" [class]="champ" />
            </label>
            <label class="text-sm text-slate-300">Charges
              <input type="number" min="0" step="1000" [(ngModel)]="formR.charges" [class]="champ" />
            </label>
          </div>
          @if (variation() !== 0) {
            <p class="text-sm" [class]="variation() > 0 ? 'text-amber-300' : 'text-emerald-300'">
              {{ variation() > 0 ? '▲ Hausse' : '▼ Baisse' }} de {{ montant(abs(variation())) }} par mois
            </p>
          }
          @if (erreurFenetre()) { <p class="text-sm text-neon-rouge">{{ erreurFenetre() }}</p> }
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button (click)="fenetre.set(null)" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 hover:bg-noir-700">Annuler</button>
          <button (click)="renouveler()" [disabled]="envoi()"
                  class="rounded-xl bg-emerald-400 px-5 py-2.5 font-bold text-noir-950 hover:bg-emerald-300 disabled:opacity-60">
            {{ envoi() ? 'Création…' : 'Créer le nouveau bail' }}
          </button>
        </div>
      </div>
    </div>
  }
  `,
})
export class FinBailPanneau {
  private service = inject(FinBailService);
  private router = inject(Router);

  bail = input.required<BailFin>();
  modifie = output<void>(); // la fiche du bail se recharge

  initiatives = INITIATIVES;
  fenetre = signal<'resiliation' | 'renouvellement' | null>(null);
  envoi = signal(false);
  notification = signal<string | null>(null);
  erreur = signal<string | null>(null);
  erreurFenetre = signal<string | null>(null);

  form: { date_effet: string; initiative: Initiative; motif: string } = {
    date_effet: new Date().toISOString().slice(0, 10), initiative: 'locataire', motif: '',
  };
  formR = { duree_mois: 12, loyer_mensuel: 0, charges: 0 };

  champ = 'mt-1.5 w-full rounded-xl border border-noir-600 bg-noir-900 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu';

  estClos(): boolean {
    return ['termine', 'resilie', 'renouvele'].includes(this.bail().statut);
  }

  // ----- Résiliation -----
  resilier(): void {
    this.envoi.set(true);
    this.erreurFenetre.set(null);
    this.service.resilier(this.bail().id, { ...this.form, motif: this.form.motif.trim() }).subscribe({
      next: (r) => { this.envoi.set(false); this.fenetre.set(null); this.notification.set(r.message); this.modifie.emit(); },
      error: (e: HttpErrorResponse) => { this.envoi.set(false); this.erreurFenetre.set(this.messageErreur(e)); },
    });
  }

  // ----- Renouvellement -----
  ouvrirRenouvellement(): void {
    const b = this.bail();
    this.formR = { duree_mois: 12, loyer_mensuel: Number(b.loyer_mensuel) || 0, charges: Number(b.charges) || 0 };
    this.erreurFenetre.set(null);
    this.fenetre.set('renouvellement');
  }

  variation(): number {
    const b = this.bail();
    return (Number(this.formR.loyer_mensuel) + Number(this.formR.charges)) - (Number(b.loyer_mensuel) + Number(b.charges || 0));
  }

  renouveler(): void {
    this.envoi.set(true);
    this.erreurFenetre.set(null);
    this.service.renouveler(this.bail().id, {
      duree_mois: this.formR.duree_mois,
      loyer_mensuel: Number(this.formR.loyer_mensuel) || null,
      charges: Number(this.formR.charges) || 0,
    }).subscribe({
      next: (r) => {
        this.envoi.set(false);
        this.fenetre.set(null);
        // On ouvre directement la fiche du NOUVEAU bail
        this.router.navigate(['/gestion/baux', r.bail_id], { state: { message: r.message } });
      },
      error: (e: HttpErrorResponse) => { this.envoi.set(false); this.erreurFenetre.set(this.messageErreur(e)); },
    });
  }

  // ----- État des lieux -----
  ouvrirEdl(): void {
    this.envoi.set(true);
    this.erreur.set(null);
    this.service.ouvrirEdlSortie(this.bail().id).subscribe({
      next: (edl) => { this.envoi.set(false); this.router.navigate(['/gestion/etats-des-lieux', edl.id]); },
      error: (e: HttpErrorResponse) => { this.envoi.set(false); this.erreur.set(this.messageErreur(e)); },
    });
  }

  private messageErreur(e: HttpErrorResponse): string {
    const erreurs = e.error?.errors as Record<string, string[]> | undefined;
    if (erreurs) return Object.values(erreurs)[0]?.[0] ?? 'Données invalides.';
    return e.error?.message ?? 'Une erreur est survenue.';
  }

  libelleStatut(s: string): string {
    return ({ termine: 'terminé', resilie: 'résilié', renouvele: 'renouvelé' } as Record<string, string>)[s] ?? s;
  }
  date(v: string | null | undefined): string {
    return v ? new Date(v).toLocaleDateString('fr-FR') : '—';
  }
  lendemain(v: string): string {
    const d = new Date(v.slice(0, 10) + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('fr-FR');
  }
  montant(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v) + ' FCFA';
  }
  abs(v: number): number { return Math.abs(v); }
}