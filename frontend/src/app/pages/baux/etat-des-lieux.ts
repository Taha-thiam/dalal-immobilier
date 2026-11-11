import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import {
  ETATS_ELEMENT, ElementEdl, EtatDesLieux, EtatElement, FinBailService,
} from '../../core/services/fin-bail.service';

@Component({
  selector: 'app-etat-des-lieux',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
  <div class="px-4 pb-32 pt-8 md:px-8">
    <div class="mx-auto max-w-5xl">

      @if (chargement()) {
        <div class="h-40 animate-pulse rounded-2xl bg-noir-800"></div>
      } @else if (edl(); as e) {

        <!-- En-tête -->
        <a [routerLink]="['/gestion/baux', e.bail_id]" class="text-sm text-slate-400 hover:text-neon-bleu">← Retour au bail</a>
        <div class="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-3xl font-extrabold text-white">
              État des lieux de <span class="text-neon-rouge text-glow-rouge">sortie</span>
            </h1>
            <p class="mt-1 text-slate-400">{{ e.bail?.numero }} · {{ e.bail?.bien }} · {{ e.bail?.locataire }}</p>
          </div>
          <span class="rounded-full border px-4 py-1.5 text-sm font-bold"
                [class]="e.statut === 'valide' ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' : 'border-amber-300/60 bg-amber-300/10 text-amber-300'">
            {{ e.statut === 'valide' ? '🔒 Validé' : '✎ Brouillon' }}
          </span>
        </div>

        @if (notification()) {
          <div class="mt-6 rounded-xl border border-neon-bleu/50 bg-neon-bleu/10 px-4 py-3 text-sm text-neon-bleu">{{ notification() }}</div>
        }
        @if (erreur()) {
          <div class="mt-6 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">{{ erreur() }}</div>
        }

        <!-- Informations générales -->
        <section class="mt-6 rounded-2xl border border-noir-600 bg-noir-800/60 p-5">
          <h2 class="text-sm font-bold uppercase tracking-wider text-neon-bleu">Informations générales</h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label class="text-sm text-slate-300">Date *
              <input type="date" [(ngModel)]="general.date_edl" [disabled]="verrouille()" [class]="champ + ' mt-1.5 w-full'" />
            </label>
            <label class="text-sm text-slate-300">Index eau
              <input type="text" [(ngModel)]="general.index_eau" [disabled]="verrouille()" placeholder="m³" [class]="champ + ' mt-1.5 w-full'" />
            </label>
            <label class="text-sm text-slate-300">Index électricité
              <input type="text" [(ngModel)]="general.index_electricite" [disabled]="verrouille()" placeholder="kWh" [class]="champ + ' mt-1.5 w-full'" />
            </label>
            <label class="text-sm text-slate-300">Clés rendues
              <input type="number" min="0" [(ngModel)]="general.nb_cles" [disabled]="verrouille()" [class]="champ + ' mt-1.5 w-full'" />
            </label>
          </div>
          <label class="mt-4 block text-sm text-slate-300">Observations générales
            <textarea rows="2" [(ngModel)]="general.observations" [disabled]="verrouille()"
                      placeholder="Ex. : logement rendu propre, peinture du salon refaite par le locataire"
                      [class]="champ + ' mt-1.5 w-full'"></textarea>
          </label>
        </section>

        <!-- Pièces -->
        @for (piece of pieces(); track piece) {
          <section class="mt-6 rounded-2xl border border-noir-600 bg-noir-800/60 p-5">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-bold text-white">{{ piece }}</h2>
              @if (!verrouille()) {
                <button (click)="ajouterElement(piece)" class="text-sm font-semibold text-neon-bleu hover:underline">+ Élément</button>
              }
            </div>

            <div class="mt-4 space-y-3">
              @for (el of elementsDe(piece); track $index) {
                <div class="rounded-xl border bg-noir-900/60 p-4"
                     [class]="el.etat === 'mauvais' ? 'border-neon-rouge/50' : 'border-noir-700'">
                  <div class="flex flex-wrap items-center gap-3">
                    <input type="text" [(ngModel)]="el.element" [disabled]="verrouille()"
                           class="min-w-40 flex-1 bg-transparent font-semibold text-white outline-none disabled:opacity-100" />

                    <!-- Bon / Moyen / Mauvais -->
                    <div class="flex gap-1.5">
                      @for (s of etats; track s.valeur) {
                        <button (click)="choisirEtat(el, s.valeur)" [disabled]="verrouille()"
                                class="rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:cursor-default"
                                [class]="el.etat === s.valeur ? s.classe : 'border-noir-600 text-slate-500 hover:text-white'">
                          {{ s.libelle }}
                        </button>
                      }
                    </div>

                    @if (!verrouille()) {
                      <button (click)="retirerElement(el)" title="Retirer" class="px-2 text-slate-500 hover:text-neon-rouge">✕</button>
                    }
                  </div>

                  @if (el.etat !== 'bon') {
                    <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_180px]">
                      <input type="text" [(ngModel)]="el.commentaire" [disabled]="verrouille()"
                             [placeholder]="el.etat === 'mauvais' ? 'Décrire le dégât (obligatoire)' : 'Commentaire'"
                             [class]="champ + ' w-full text-sm'" />
                      <div class="relative">
                        <input type="number" min="0" step="1000" [(ngModel)]="el.montant_retenue" [disabled]="verrouille()"
                               [class]="champ + ' w-full pr-16 text-right text-sm'" />
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">FCFA</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </section>
        }

        @if (!verrouille()) {
          <div class="mt-6 flex gap-3">
            <input type="text" [(ngModel)]="nouvellePiece" placeholder="Nouvelle pièce (ex. : Chambre 2, Terrasse)"
                   [class]="champ + ' flex-1'" (keyup.enter)="ajouterPiece()" />
            <button (click)="ajouterPiece()" class="rounded-xl border border-neon-bleu/60 px-5 font-semibold text-neon-bleu hover:bg-neon-bleu/10">+ Pièce</button>
          </div>
        }
      }
    </div>
  </div>

  <!-- Barre d'actions fixe en bas -->
  @if (edl(); as e) {
    <div class="fixed inset-x-0 bottom-0 z-30 border-t border-noir-600 bg-noir-900/95 backdrop-blur lg:left-64">
      <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8">
        <div>
          <p class="text-xs uppercase tracking-wider text-slate-400">Total des retenues</p>
          <p class="text-2xl font-extrabold" [class]="total() > 0 ? 'text-neon-rouge text-glow-rouge' : 'text-emerald-300'">{{ montant(total()) }}</p>
          <p class="text-xs text-slate-500">{{ compter('mauvais') }} mauvais · {{ compter('moyen') }} moyen(s)</p>
        </div>

        <div class="flex flex-wrap gap-3">
          @if (!verrouille()) {
            <button (click)="enregistrer()" [disabled]="envoi()"
                    class="rounded-xl border border-neon-bleu/60 px-5 py-3 font-semibold text-neon-bleu hover:bg-neon-bleu/10 disabled:opacity-50">
              Enregistrer le brouillon
            </button>
            <button (click)="valider()" [disabled]="envoi()"
                    class="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-noir-950 hover:bg-emerald-300 disabled:opacity-50">
              {{ envoi() ? '…' : 'Valider l’état des lieux' }}
            </button>
          } @else if (e.bail && !['termine', 'resilie', 'renouvele'].includes(e.bail.statut)) {
            <button (click)="cloturer()" [disabled]="envoi()"
                    class="rounded-xl bg-neon-rouge px-5 py-3 font-bold text-white hover:glow-rouge disabled:opacity-50">
              {{ envoi() ? '…' : 'Clôturer le bail et libérer le bien' }}
            </button>
          } @else {
            <a [routerLink]="['/gestion/baux', e.bail_id]" class="rounded-xl border border-emerald-400/60 px-5 py-3 font-semibold text-emerald-300">Bail clôturé ✓ — voir le bail</a>
          }
        </div>
      </div>
    </div>
  }
  `,
})
export class EtatDesLieuxPage implements OnInit {
  private service = inject(FinBailService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  etats = ETATS_ELEMENT;

  edl = signal<EtatDesLieux | null>(null);
  elements = signal<ElementEdl[]>([]);
  chargement = signal(true);
  envoi = signal(false);
  notification = signal<string | null>(null);
  erreur = signal<string | null>(null);

  general = { date_edl: '', observations: '' as string | null, index_eau: '' as string | null, index_electricite: '' as string | null, nb_cles: null as number | null };
  nouvellePiece = '';

  champ = 'rounded-xl border border-noir-600 bg-noir-900 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu disabled:border-transparent disabled:bg-transparent';

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.service.edl(id).subscribe({
      next: (e) => { this.remplir(e); this.chargement.set(false); },
      error: () => { this.erreur.set('État des lieux introuvable.'); this.chargement.set(false); },
    });
  }

  private remplir(e: EtatDesLieux): void {
    this.edl.set(e);
    this.elements.set(e.elements.map((x) => ({ ...x, montant_retenue: Number(x.montant_retenue) || 0 })));
    this.general = {
      date_edl: e.date_edl?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      observations: e.observations, index_eau: e.index_eau,
      index_electricite: e.index_electricite, nb_cles: e.nb_cles,
    };
  }

  verrouille(): boolean {
    return this.edl()?.statut === 'valide';
  }

  // ----- Pièces et éléments -----
  pieces(): string[] {
    return [...new Set(this.elements().map((e) => e.piece))];
  }
  elementsDe(piece: string): ElementEdl[] {
    return this.elements().filter((e) => e.piece === piece);
  }
  choisirEtat(el: ElementEdl, etat: EtatElement): void {
    el.etat = etat;
    if (etat === 'bon') { el.montant_retenue = 0; el.commentaire = null; }
    this.elements.update((l) => [...l]);
  }
  ajouterElement(piece: string): void {
    this.elements.update((l) => [...l, { piece, element: 'Nouvel élément', etat: 'bon', commentaire: null, montant_retenue: 0 }]);
  }
  retirerElement(el: ElementEdl): void {
    this.elements.update((l) => l.filter((x) => x !== el));
  }
  ajouterPiece(): void {
    const nom = this.nouvellePiece.trim();
    if (!nom) return;
    this.elements.update((l) => [...l,
      { piece: nom, element: 'Murs', etat: 'bon', commentaire: null, montant_retenue: 0 },
      { piece: nom, element: 'Sol', etat: 'bon', commentaire: null, montant_retenue: 0 },
    ]);
    this.nouvellePiece = '';
  }

  total(): number {
    return this.elements().reduce((s, e) => s + (Number(e.montant_retenue) || 0), 0);
  }
  compter(etat: EtatElement): number {
    return this.elements().filter((e) => e.etat === etat).length;
  }

  // ----- Actions -----
  private charge() {
    return { ...this.general, elements: this.elements() };
  }

  enregistrer(apres?: () => void): void {
    const id = this.edl()!.id;
    this.envoi.set(true);
    this.erreur.set(null);
    this.service.enregistrerEdl(id, this.charge()).subscribe({
      next: (r) => {
        this.remplir(r.edl);
        this.envoi.set(false);
        if (apres) apres(); else this.notification.set(r.message);
      },
      error: (e: HttpErrorResponse) => { this.envoi.set(false); this.erreur.set(this.messageErreur(e)); },
    });
  }

  /** On enregistre d'abord (pour ne rien perdre), puis on valide. */
  valider(): void {
    this.enregistrer(() => {
      this.envoi.set(true);
      this.service.validerEdl(this.edl()!.id).subscribe({
        next: (r) => { this.remplir(r.edl); this.envoi.set(false); this.notification.set(r.message + ' Vous pouvez maintenant clôturer le bail.'); },
        error: (e: HttpErrorResponse) => { this.envoi.set(false); this.erreur.set(this.messageErreur(e)); },
      });
    });
  }

  cloturer(): void {
    const e = this.edl()!;
    this.envoi.set(true);
    this.erreur.set(null);
    this.service.cloturer(e.bail_id).subscribe({
      next: (r) => {
        this.envoi.set(false);
        this.notification.set(r.message);
        this.edl.update((x) => x && x.bail ? { ...x, bail: { ...x.bail, statut: 'resilie' } } : x);
        setTimeout(() => this.router.navigate(['/gestion/baux', e.bail_id]), 2500);
      },
      error: (err: HttpErrorResponse) => { this.envoi.set(false); this.erreur.set(this.messageErreur(err)); },
    });
  }

  private messageErreur(e: HttpErrorResponse): string {
    const erreurs = e.error?.errors as Record<string, string[]> | undefined;
    if (erreurs) return Object.values(erreurs)[0]?.[0] ?? 'Données invalides.';
    return e.error?.message ?? 'Une erreur est survenue.';
  }

  montant(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v) + ' FCFA';
  }
}