import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { LowerCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../../core/models/pagination.model';
import {
    ACharge, CATEGORIES, CHARGES, Categorie, Intervention, MaintenanceService, Reponse,
    STATUTS_SIGNALEMENT, Signalement, URGENCES, Urgence,
} from '../../core/services/maintenance.service';

type TypeFenetre = 'signaler' | 'planifier' | 'realiser' | 'rejeter';

/** Une seule forme pour toutes les fenêtres : s et i sont facultatifs. */
interface Fenetre {
    type: TypeFenetre;
    s?: Signalement;
    i?: Intervention;
}

interface BienChoix { id: number; reference: string; titre: string; statut?: string }

@Component({
    selector: 'app-maintenance',
    standalone: true,
    imports: [FormsModule, LowerCasePipe],
    template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-7xl">

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold text-white">Maintenance</h1>
          <p class="mt-1 text-slate-400">Pannes signalées, interventions des prestataires, suivi jusqu'à la résolution.</p>
        </div>
        <button (click)="ouvrir('signaler')"
                class="rounded-xl bg-neon-rouge px-5 py-3 font-bold text-white transition hover:glow-rouge">
          + Signaler une panne
        </button>
      </div>

      <!-- Filtres -->
      <div class="mt-6 flex flex-wrap items-center gap-2">
        @for (filtre of filtres; track filtre.valeur) {
          <button (click)="statut = filtre.valeur; charger(1)"
                  class="rounded-full border px-4 py-2 text-sm font-semibold transition"
                  [class]="statut === filtre.valeur ? 'border-neon-bleu bg-neon-bleu/10 text-neon-bleu glow-bleu' : 'border-noir-600 text-slate-400 hover:text-white'">
            {{ filtre.libelle }}
          </button>
        }
        <select [(ngModel)]="urgence" (ngModelChange)="charger(1)" [class]="champ + ' ml-auto'">
          <option value="">Toutes urgences</option>
          @for (u of urgences; track u.valeur) { <option [value]="u.valeur">Urgence {{ u.libelle | lowercase }}</option> }
        </select>
      </div>

      <input type="search" placeholder="Rechercher : n° SIG, titre, bien…"
             (input)="recherche$.next($any($event.target).value)" [class]="champ + ' mt-4 w-full'" />

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

      <!-- Liste -->
      <div class="mt-6 space-y-3">
        @if (chargement()) {
          @for (n of [1, 2, 3]; track n) { <div class="h-24 animate-pulse rounded-2xl bg-noir-800"></div> }
        } @else {
          @for (s of page()?.data ?? []; track s.id) {
            <article class="overflow-hidden rounded-2xl border bg-noir-800/60 transition"
                     [class]="s.urgence === 'haute' && ouvert(s) ? 'border-neon-rouge/60 glow-rouge' : 'border-noir-600'">

              <!-- Ligne résumé (cliquable) -->
              <button (click)="basculer(s.id)" class="flex w-full flex-wrap items-center gap-4 p-5 text-left hover:bg-noir-700/40">
                <span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-noir-600 bg-noir-900 text-2xl">{{ icone(s.categorie) }}</span>
                <div class="min-w-56 flex-1">
                  <p class="font-semibold text-white">{{ s.titre }}</p>
                  <p class="text-xs text-slate-500">
                    <span class="font-mono">{{ s.numero }}</span> · {{ s.bien?.reference }} — {{ s.bien?.titre }}
                    @if (s.locataire) { · {{ s.locataire.prenom }} {{ s.locataire.nom }} }
                  </p>
                </div>
                <span class="text-xs font-bold uppercase" [class]="classeUrgence(s.urgence)">{{ libelleUrgence(s.urgence) }}</span>
                <span class="rounded-full border px-3 py-1 text-xs font-semibold" [class]="statuts[s.statut].classe">{{ statuts[s.statut].libelle }}</span>
                <span class="text-xs text-slate-500">{{ date(s.created_at) }}</span>
                <span class="text-slate-500 transition" [class.rotate-180]="ouvertId() === s.id">▾</span>
              </button>

              <!-- Détail -->
              @if (ouvertId() === s.id) {
                <div class="border-t border-noir-700 bg-noir-900/50 p-5">
                  @if (s.description) { <p class="whitespace-pre-line text-sm text-slate-300">{{ s.description }}</p> }
                  @if (s.locataire?.telephone; as tel) {
                    <p class="mt-2 text-sm text-slate-400">Locataire : <a [href]="'tel:' + tel" class="text-neon-bleu hover:underline">{{ tel }}</a></p>
                  }
                  @if (s.motif_rejet) { <p class="mt-2 text-sm text-slate-500">Rejeté : « {{ s.motif_rejet }} »</p> }

                  <h3 class="mt-5 text-xs font-bold uppercase tracking-wider text-neon-bleu">Interventions</h3>
                  <div class="mt-3 space-y-2">
                    @for (i of s.interventions; track i.id) {
                      <div class="flex flex-wrap items-center gap-3 rounded-xl border border-noir-700 bg-noir-800/60 p-3 text-sm">
                        <span class="h-2.5 w-2.5 rounded-full"
                              [class]="i.statut === 'realisee' ? 'bg-emerald-400' : i.statut === 'annulee' ? 'bg-slate-500' : 'bg-amber-300 animate-pulse'"></span>
                        <div class="min-w-48 flex-1">
                          <p class="font-semibold text-white">{{ i.prestataire_nom }}
                            @if (i.prestataire_telephone) { <span class="font-normal text-slate-500">· {{ i.prestataire_telephone }}</span> }
                          </p>
                          <p class="text-xs text-slate-400">{{ resumeIntervention(i) }}</p>
                          @if (i.rapport) { <p class="mt-1 text-xs text-slate-500">{{ i.rapport }}</p> }
                        </div>
                        @if (i.statut === 'planifiee') {
                          <button (click)="ouvrir('realiser', s, i)" class="rounded-lg bg-emerald-400/90 px-3 py-1.5 text-xs font-bold text-noir-950 hover:bg-emerald-300">Réalisée</button>
                          <button (click)="annulerIntervention(i)" class="rounded-lg px-3 py-1.5 text-xs font-semibold text-neon-rouge hover:bg-neon-rouge/10">Annuler</button>
                        }
                      </div>
                    } @empty {
                      <p class="text-sm text-slate-500">Aucune intervention pour l'instant.</p>
                    }
                  </div>

                  @if (s.cout_total > 0) { <p class="mt-3 text-sm text-slate-400">Coût total : <span class="font-bold text-white">{{ montant(s.cout_total) }}</span></p> }

                  @if (ouvert(s)) {
                    <div class="mt-5 flex flex-wrap gap-2">
                      <button (click)="ouvrir('planifier', s)" class="rounded-xl bg-neon-bleu px-4 py-2 text-sm font-bold text-noir-950 hover:glow-bleu">+ Planifier une intervention</button>
                      <button (click)="resoudre(s)" class="rounded-xl border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10">Marquer résolu</button>
                      @if (s.statut === 'nouveau') {
                        <button (click)="ouvrir('rejeter', s)" class="rounded-xl px-4 py-2 text-sm font-semibold text-slate-400 hover:text-neon-rouge">Rejeter</button>
                      }
                    </div>
                  }
                </div>
              }
            </article>
          } @empty {
            <div class="rounded-2xl border border-emerald-400/40 bg-emerald-400/5 px-5 py-14 text-center">
              <p class="text-4xl">🛠️</p>
              <p class="mt-3 font-semibold text-emerald-300">Aucun signalement dans cette catégorie.</p>
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

  <!-- ===================== Fenêtres ===================== -->
  @if (fenetre(); as f) {
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="fermer()">
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neon-bleu/40 bg-noir-800 p-6" (click)="$event.stopPropagation()">

        <!-- Signaler -->
        @if (f.type === 'signaler') {
          <h2 class="text-lg font-bold text-white">Signaler une panne</h2>
          <div class="mt-5 grid gap-4">
            <label class="text-sm text-slate-300">Bien concerné *
              <select [(ngModel)]="fs.bien_id" [class]="champ + ' mt-1.5 w-full'">
                <option [ngValue]="null" disabled>— Choisir —</option>
                @for (b of biens(); track b.id) { <option [ngValue]="b.id">{{ b.reference }} — {{ b.titre }}</option> }
              </select>
            </label>
            <label class="text-sm text-slate-300">Titre *
              <input type="text" [(ngModel)]="fs.titre" placeholder="Ex. : Fuite sous l'évier" [class]="champ + ' mt-1.5 w-full'" />
            </label>
            <div>
              <p class="text-sm text-slate-300">Catégorie *</p>
              <div class="mt-1.5 grid grid-cols-4 gap-2">
                @for (c of categories; track c.valeur) {
                  <button (click)="fs.categorie = c.valeur" type="button"
                          class="rounded-xl border p-2 text-center text-xs transition"
                          [class]="fs.categorie === c.valeur ? 'border-neon-bleu bg-neon-bleu/10 text-neon-bleu' : 'border-noir-600 text-slate-400 hover:text-white'">
                    <span class="block text-xl">{{ c.icone }}</span>{{ c.libelle }}
                  </button>
                }
              </div>
            </div>
            <div>
              <p class="text-sm text-slate-300">Urgence *</p>
              <div class="mt-1.5 grid grid-cols-3 gap-2">
                @for (u of urgences; track u.valeur) {
                  <button (click)="fs.urgence = u.valeur" type="button"
                          class="rounded-xl border py-2 text-sm font-semibold transition"
                          [class]="fs.urgence === u.valeur ? (u.valeur === 'haute' ? 'border-neon-rouge bg-neon-rouge/10 text-neon-rouge glow-rouge' : 'border-neon-bleu bg-neon-bleu/10 text-neon-bleu') : 'border-noir-600 text-slate-400'">
                    {{ u.libelle }}
                  </button>
                }
              </div>
            </div>
            <label class="text-sm text-slate-300">Description
              <textarea rows="3" [(ngModel)]="fs.description" placeholder="Depuis quand ? Où exactement ?" [class]="champ + ' mt-1.5 w-full'"></textarea>
            </label>
          </div>
        }

        <!-- Planifier -->
        @if (f.type === 'planifier') {
          <h2 class="text-lg font-bold text-white">Planifier une intervention</h2>
          <p class="mt-1 text-sm text-slate-400">{{ f.s?.numero }} · {{ f.s?.titre }}</p>
          <div class="mt-5 grid gap-4">
            <label class="text-sm text-slate-300">Prestataire *
              <input type="text" [(ngModel)]="fp.prestataire_nom" placeholder="Ex. : Froid Service Dakar" [class]="champ + ' mt-1.5 w-full'" />
            </label>
            <label class="text-sm text-slate-300">Téléphone du prestataire
              <input type="tel" [(ngModel)]="fp.prestataire_telephone" placeholder="77 123 45 67" [class]="champ + ' mt-1.5 w-full'" />
            </label>
            <label class="text-sm text-slate-300">Date et heure du passage *
              <input type="datetime-local" [(ngModel)]="fp.date_prevue" [class]="champ + ' mt-1.5 w-full'" />
            </label>
          </div>
        }

        <!-- Réaliser -->
        @if (f.type === 'realiser') {
          <h2 class="text-lg font-bold text-white">Intervention réalisée</h2>
          <p class="mt-1 text-sm text-slate-400">{{ f.i?.prestataire_nom }} · {{ f.s?.titre }}</p>
          <div class="mt-5 grid gap-4">
            <div class="grid grid-cols-2 gap-3">
              <label class="text-sm text-slate-300">Date *
                <input type="date" [(ngModel)]="fr.date_realisation" [max]="aujourdhui" [class]="champ + ' mt-1.5 w-full'" />
              </label>
              <label class="text-sm text-slate-300">Coût (FCFA)
                <input type="number" min="0" step="1000" [(ngModel)]="fr.cout" [class]="champ + ' mt-1.5 w-full'" />
              </label>
            </div>
            @if (fr.cout > 0) {
              <div>
                <p class="text-sm text-slate-300">À la charge de *</p>
                <div class="mt-1.5 grid grid-cols-3 gap-2">
                  @for (c of charges; track c.valeur) {
                    <button (click)="fr.a_charge_de = c.valeur" type="button"
                            class="rounded-xl border py-2 text-sm font-semibold transition"
                            [class]="fr.a_charge_de === c.valeur ? 'border-neon-bleu bg-neon-bleu/10 text-neon-bleu' : 'border-noir-600 text-slate-400'">
                      {{ c.libelle }}
                    </button>
                  }
                </div>
              </div>
            }
            <label class="text-sm text-slate-300">Rapport
              <textarea rows="3" [(ngModel)]="fr.rapport" placeholder="Ex. : recharge de gaz + nettoyage du filtre" [class]="champ + ' mt-1.5 w-full'"></textarea>
            </label>
          </div>
        }

        <!-- Rejeter -->
        @if (f.type === 'rejeter') {
          <h2 class="text-lg font-bold text-white">Rejeter le signalement</h2>
          <p class="mt-1 text-sm text-slate-400">{{ f.s?.numero }} · {{ f.s?.titre }}</p>
          <label class="mt-5 block text-sm text-slate-300">Motif *
            <textarea rows="3" [(ngModel)]="motifRejet" placeholder="Ex. : le disjoncteur était simplement baissé" [class]="champ + ' mt-1.5 w-full'"></textarea>
          </label>
        }

        @if (erreurFenetre()) { <p class="mt-4 text-sm text-neon-rouge">{{ erreurFenetre() }}</p> }

        <div class="mt-6 flex justify-end gap-3">
          <button (click)="fermer()" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 hover:bg-noir-700">Annuler</button>
          <button (click)="confirmer(f)" [disabled]="envoi()"
                  class="rounded-xl bg-neon-bleu px-5 py-2.5 font-bold text-noir-950 hover:glow-bleu disabled:opacity-60">
            {{ envoi() ? 'Envoi…' : 'Confirmer' }}
          </button>
        </div>
      </div>
    </div>
  }
  `,
})
export class Maintenance implements OnInit {
    private service = inject(MaintenanceService);
    private http = inject(HttpClient);
    private destroyRef = inject(DestroyRef);

    statuts = STATUTS_SIGNALEMENT;
    urgences = URGENCES;
    categories = CATEGORIES;
    charges = CHARGES;
    filtres = [
        { valeur: 'ouverts', libelle: 'Ouverts' },
        { valeur: '', libelle: 'Tous' },
        { valeur: 'resolu', libelle: 'Résolus' },
        { valeur: 'rejete', libelle: 'Rejetés' },
    ];

    page = signal<Page<Signalement> | null>(null);
    biens = signal<BienChoix[]>([]);
    chargement = signal(true);
    notification = signal<string | null>(null);
    erreur = signal<string | null>(null);
    ouvertId = signal<number | null>(null);

    fenetre = signal<Fenetre | null>(null);
    envoi = signal(false);
    erreurFenetre = signal<string | null>(null);

    statut = 'ouverts';
    urgence = '';
    private texte = '';
    recherche$ = new Subject<string>();

    aujourdhui = new Date().toISOString().slice(0, 10);
    fs = this.videSignaler();
    fp = this.videPlanifier();
    fr = this.videRealiser();
    motifRejet = '';

    champ = 'rounded-xl border border-noir-600 bg-noir-900 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

    ngOnInit(): void {
        this.recherche$
            .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
            .subscribe((t) => { this.texte = t; this.charger(1); });
        this.charger(1);
    }

    charger(numero: number): void {
        this.chargement.set(true);
        this.service.lister(numero, this.statut, this.urgence, this.texte).subscribe({
            next: (p) => { this.page.set(p); this.chargement.set(false); },
            error: () => { this.erreur.set('Chargement impossible.'); this.chargement.set(false); },
        });
    }

    /** Liste des biens pour le formulaire (chargée une seule fois). */
    private chargerBiens(): void {
        if (this.biens().length) return;
        this.http.get<Page<BienChoix> | BienChoix[]>(`${environment.apiUrl}/biens`, { params: { per_page: 100 } }).subscribe({
            next: (r) => this.biens.set(Array.isArray(r) ? r : r.data),
        });
    }

    basculer(id: number): void {
        this.ouvertId.set(this.ouvertId() === id ? null : id);
    }

    ouvert(s: Signalement): boolean {
        return s.statut === 'nouveau' || s.statut === 'en_cours';
    }

    ouvrir(type: TypeFenetre, s?: Signalement, i?: Intervention): void {
        this.erreurFenetre.set(null);
        if (type === 'signaler') { this.fs = this.videSignaler(); this.chargerBiens(); }
        if (type === 'planifier') this.fp = this.videPlanifier();
        if (type === 'realiser') this.fr = this.videRealiser();
        if (type === 'rejeter') this.motifRejet = '';
        this.fenetre.set({ type, s, i });
    }

    fermer(): void {
        this.fenetre.set(null);
    }

    confirmer(f: Fenetre): void {
        let requete: Observable<Reponse> | null = null;

        if (f.type === 'signaler') {
            if (!this.fs.bien_id) { this.erreurFenetre.set('Choisissez le bien concerné.'); return; }
            requete = this.service.signaler({
                bien_id: this.fs.bien_id, titre: this.fs.titre, categorie: this.fs.categorie,
                urgence: this.fs.urgence, description: this.fs.description.trim() || null,
            });
        } else if (f.type === 'planifier' && f.s) {
            requete = this.service.planifier(f.s.id, {
                prestataire_nom: this.fp.prestataire_nom,
                prestataire_telephone: this.fp.prestataire_telephone.trim() || null,
                date_prevue: this.fp.date_prevue.replace('T', ' '),
            });
        } else if (f.type === 'realiser' && f.i) {
            const cout = Number(this.fr.cout) || 0;
            requete = this.service.realiser(f.i.id, {
                date_realisation: this.fr.date_realisation, cout,
                a_charge_de: cout > 0 ? this.fr.a_charge_de : null,
                rapport: this.fr.rapport.trim() || null,
            });
        } else if (f.type === 'rejeter' && f.s) {
            requete = this.service.rejeter(f.s.id, this.motifRejet.trim());
        }

        if (!requete) return;

        this.envoi.set(true);
        this.erreurFenetre.set(null);
        requete.subscribe({
            next: (r) => {
                this.envoi.set(false);
                this.fermer();
                this.notification.set(r.message);
                this.ouvertId.set(r.signalement.id);
                this.charger(this.page()?.current_page ?? 1);
            },
            error: (e: HttpErrorResponse) => { this.envoi.set(false); this.erreurFenetre.set(this.messageErreur(e)); },
        });
    }

    annulerIntervention(i: Intervention): void {
        this.service.annulerIntervention(i.id, 'Prestataire indisponible').subscribe({
            next: (r) => { this.notification.set(r.message); this.charger(this.page()?.current_page ?? 1); },
            error: (e: HttpErrorResponse) => this.erreur.set(this.messageErreur(e)),
        });
    }

    resoudre(s: Signalement): void {
        this.service.resoudre(s.id).subscribe({
            next: (r) => { this.notification.set(r.message); this.charger(this.page()?.current_page ?? 1); },
            error: (e: HttpErrorResponse) => this.erreur.set(this.messageErreur(e)),
        });
    }

    private messageErreur(e: HttpErrorResponse): string {
        const erreurs = e.error?.errors as Record<string, string[]> | undefined;
        if (erreurs) return Object.values(erreurs)[0]?.[0] ?? 'Données invalides.';
        return e.error?.message ?? 'Une erreur est survenue.';
    }

    // ----- Formulaires vides -----
    private videSignaler() {
        return { bien_id: null as number | null, titre: '', description: '', categorie: 'autre' as Categorie, urgence: 'normale' as Urgence };
    }

    private videPlanifier() {
        const demain = new Date(Date.now() + 86_400_000);
        demain.setHours(10, 0, 0, 0);
        const local = new Date(demain.getTime() - demain.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
        return { prestataire_nom: '', prestataire_telephone: '', date_prevue: local };
    }

    private videRealiser() {
        return { date_realisation: new Date().toISOString().slice(0, 10), cout: 0, a_charge_de: 'proprietaire' as ACharge | null, rapport: '' };
    }

    // ----- Affichage -----
    resumeIntervention(i: Intervention): string {
        if (i.statut === 'planifiee') return 'Prévue le ' + this.dateHeure(i.date_prevue);
        if (i.statut === 'annulee') return 'Annulée';
        let texte = 'Réalisée le ' + this.date(i.date_realisation) + ' · ' + this.montant(i.cout);
        if (i.a_charge_de) texte += ' à la charge du ' + this.libelleCharge(i.a_charge_de).toLowerCase();
        return texte;
    }

    icone(c: Categorie): string { return CATEGORIES.find((x) => x.valeur === c)?.icone ?? '🔧'; }
    libelleUrgence(u: Urgence): string { return URGENCES.find((x) => x.valeur === u)?.libelle ?? u; }
    classeUrgence(u: Urgence): string { return URGENCES.find((x) => x.valeur === u)?.classe ?? ''; }
    libelleCharge(c: ACharge): string { return CHARGES.find((x) => x.valeur === c)?.libelle ?? c; }
    montant(v: string | number | null): string {
        return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v) || 0) + ' FCFA';
    }
    date(v: string | null): string { return v ? new Date(v).toLocaleDateString('fr-FR') : '—'; }
    dateHeure(v: string): string {
        return new Date(v.replace(' ', 'T')).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    }
}