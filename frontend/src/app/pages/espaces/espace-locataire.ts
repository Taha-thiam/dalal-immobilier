import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MODES_PAIEMENT } from '../../core/models/paiement.model';

interface LocationL { id: number; numero: string; statut: string; en_cours: boolean; bien: string | null; quartier: string | null; loyer: number; nb_retard: number; total_retard: number }
interface EcheanceL { id: number; mois: string; date_limite: string; montant_du: number; reste_du: number; en_attente: number; statut: string; en_retard: boolean }
interface PaiementL { id: number; mois: string | null; montant: number; mode_paiement: string; reference: string | null; date_paiement: string; statut: string; quittance: string | null }
interface SignalementL { id: number; numero: string; titre: string; categorie: string; urgence: string; statut: string; created_at: string; prochaine_visite: string | null }
interface TableauLocataire {
  locataire: { nom: string; prenom: string; email: string; telephone: string } | null;
  baux: LocationL[];
  bail: {
    id: number; numero: string; statut: string; en_cours: boolean; date_debut: string; date_fin: string; date_resiliation: string | null;
    loyer_mensuel: number; charges: number; jour_echeance: number;
    caution: { montant: number; statut: string } | null;
    bien: { titre: string; reference: string; quartier: string | null } | null;
  } | null;
  resume?: { prochaine_echeance: EcheanceL | null; total_retard: number; nb_retard: number; total_paye: number; retard_global: number; nb_retard_global: number };
  echeances?: EcheanceL[];
  paiements?: PaiementL[];
  signalements?: SignalementL[];
}

@Component({
  selector: 'app-espace-locataire',
  standalone: true,
  imports: [FormsModule],
  template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-6xl">

      @if (chargement() && !t()) {
        <div class="h-64 animate-pulse rounded-2xl bg-noir-800"></div>
      } @else if (t(); as d) {

        <p class="text-sm text-slate-400">Bonjour,</p>
        <h1 class="text-3xl font-extrabold text-white">{{ d.locataire?.prenom }} {{ d.locataire?.nom }} <span class="text-neon-bleu text-glow-bleu">👋</span></h1>

        @if (notification()) {
          <div class="mt-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
            <span>{{ notification() }}</span><button (click)="notification.set(null)" class="text-lg leading-none">×</button>
          </div>
        }
        @if (erreur()) {
          <div class="mt-6 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">{{ erreur() }}</div>
        }

        <!-- ===== MES LOCATIONS : le sélecteur ===== -->
        @if (d.baux.length > 1) {
          <section class="mt-6">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Mes locations ({{ d.baux.length }})</p>
            <div class="mt-3 flex gap-3 overflow-x-auto pb-2">
              @for (l of d.baux; track l.id) {
                <button (click)="charger(l.id)"
                        class="min-w-60 shrink-0 rounded-2xl border p-4 text-left transition"
                        [class]="l.id === d.bail?.id ? 'border-neon-bleu bg-neon-bleu/10 glow-bleu' : 'border-noir-600 bg-noir-800/60 hover:border-neon-bleu/50'"
                        [class.opacity-60]="!l.en_cours">
                  <div class="flex items-start justify-between gap-2">
                    <p class="font-bold" [class]="l.id === d.bail?.id ? 'text-neon-bleu' : 'text-white'">🏠 {{ l.bien }}</p>
                    @if (l.nb_retard > 0) { <span class="rounded-full bg-neon-rouge px-2 py-0.5 text-[11px] font-bold text-white">{{ l.nb_retard }}</span> }
                  </div>
                  <p class="text-xs text-slate-500">{{ l.quartier }} · <span class="font-mono">{{ l.numero }}</span></p>
                  <p class="mt-2 text-sm text-slate-300">{{ montant(l.loyer) }}<span class="text-xs text-slate-500"> /mois</span></p>
                  @if (!l.en_cours) { <p class="mt-1 text-xs text-slate-500">Bail terminé</p> }
                </button>
              }
            </div>
          </section>
        }

        @if (!d.bail) {
          <div class="mt-8 rounded-2xl border border-noir-600 bg-noir-800/60 p-10 text-center text-slate-400">Aucun bail n'est encore rattaché à votre compte.</div>
        } @else {
          @let b = d.bail;

          <!-- ===== Alerte retard (toutes locations) ===== -->
          @if ((d.resume?.nb_retard_global ?? 0) > 0) {
            <div class="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-neon-rouge/60 bg-neon-rouge/10 p-5 glow-rouge">
              <div>
                <p class="font-bold text-neon-rouge text-glow-rouge">⚠ {{ d.resume?.nb_retard_global }} loyer(s) en retard</p>
                <p class="text-sm text-slate-300">Total dû : <span class="font-bold text-white">{{ montant(d.resume?.retard_global ?? 0) }}</span>
                  @if (d.baux.length > 1) { <span class="text-slate-500"> — toutes locations confondues</span> }</p>
              </div>
              <button (click)="ouvrirPaiement(null)" class="rounded-xl bg-neon-rouge px-5 py-2.5 font-bold text-white hover:glow-rouge">Régulariser</button>
            </div>
          }

          <div class="mt-6 grid gap-4 lg:grid-cols-3">
            <!-- ===== Prochain loyer de la location affichée ===== -->
            <div class="rounded-2xl border border-neon-bleu/50 bg-noir-800/70 p-6 glow-bleu lg:col-span-2">
              @if (!b.en_cours) {
                <p class="text-xl font-bold text-slate-300">Ce bail est terminé.</p>
                <p class="text-sm text-slate-500">Vous pouvez encore consulter et télécharger vos quittances ci-dessous.</p>
              } @else if (d.resume?.prochaine_echeance; as e) {
                <p class="text-xs font-semibold uppercase tracking-wider text-neon-bleu">Prochain loyer · {{ b.bien?.titre }}</p>
                <p class="mt-2 text-4xl font-extrabold text-white">{{ montant(e.reste_du - e.en_attente) }}</p>
                <p class="mt-1 capitalize text-slate-400">{{ nomMois(e.mois) }} · à régler avant le {{ date(e.date_limite) }}</p>
                <button (click)="ouvrirPaiement(e)" class="mt-5 rounded-xl bg-neon-bleu px-6 py-3 font-bold text-noir-950 transition hover:glow-bleu">
                  J'ai payé ce loyer
                </button>
                <p class="mt-2 text-xs text-slate-500">Payez par Wave ou Orange Money, puis déclarez-le ici avec la référence reçue par SMS.</p>
              } @else {
                <p class="text-4xl">🎉</p>
                <p class="mt-2 text-xl font-bold text-emerald-300">Vous êtes à jour pour ce logement !</p>
                <p class="text-sm text-slate-400">Aucun loyer à payer pour le moment.</p>
              }
            </div>

            <!-- ===== Ce logement ===== -->
            <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-6">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Ce logement</p>
              <p class="mt-2 font-bold text-white">{{ b.bien?.titre }}</p>
              <p class="text-sm text-slate-400">📍 {{ b.bien?.quartier }}</p>
              <dl class="mt-4 space-y-1.5 text-sm">
                <div class="flex justify-between"><dt class="text-slate-500">Bail</dt><dd class="font-mono text-slate-300">{{ b.numero }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Loyer</dt><dd>{{ montant(b.loyer_mensuel + b.charges) }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Jusqu'au</dt><dd>{{ date(b.date_resiliation ?? b.date_fin) }}</dd></div>
                @if (b.caution) { <div class="flex justify-between"><dt class="text-slate-500">Caution</dt><dd>{{ montant(b.caution.montant) }}</dd></div> }
              </dl>
              @if (b.en_cours) {
                <button (click)="ouvrirSignalement()" class="mt-5 w-full rounded-xl border border-neon-rouge/60 py-2.5 text-sm font-semibold text-neon-rouge transition hover:bg-neon-rouge/10">
                  🔧 Signaler une panne
                </button>
              }
            </div>
          </div>

          <!-- ===== Échéancier ===== -->
          <section class="mt-8" [class.opacity-50]="chargement()">
            <h2 class="text-lg font-bold text-white">Échéancier · <span class="text-neon-bleu">{{ b.bien?.titre }}</span></h2>
            <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              @for (e of d.echeances; track e.id) {
                <div class="rounded-xl border p-3" [class]="classeEcheance(e)">
                  <p class="text-sm font-bold capitalize text-white">{{ moisCourt(e.mois) }}</p>
                  <p class="mt-1 text-xs font-semibold uppercase" [class]="couleurEcheance(e)">{{ libelleEcheance(e) }}</p>
                </div>
              }
            </div>
          </section>

          <!-- ===== Paiements et quittances ===== -->
          <section class="mt-8" [class.opacity-50]="chargement()">
            <h2 class="text-lg font-bold text-white">Paiements et quittances · <span class="text-neon-bleu">{{ b.bien?.titre }}</span></h2>
            <div class="mt-4 overflow-x-auto rounded-2xl border border-noir-600 bg-noir-800/60">
              <table class="w-full min-w-[640px] text-left text-sm">
                <thead class="border-b border-noir-600 text-xs uppercase tracking-wider text-slate-400">
                  <tr><th class="px-5 py-3">Mois</th><th class="px-5 py-3">Paiement</th><th class="px-5 py-3 text-right">Montant</th><th class="px-5 py-3">Statut</th><th class="px-5 py-3 text-right">Quittance</th></tr>
                </thead>
                <tbody>
                  @for (p of d.paiements; track p.id) {
                    <tr class="border-b border-noir-700">
                      <td class="px-5 py-3 capitalize text-white">{{ p.mois ? nomMois(p.mois) : '—' }}</td>
                      <td class="px-5 py-3 text-slate-400">{{ libelleMode(p.mode_paiement) }} · {{ date(p.date_paiement) }}</td>
                      <td class="px-5 py-3 text-right font-bold text-white">{{ montant(p.montant) }}</td>
                      <td class="px-5 py-3"><span class="rounded-full border px-2.5 py-0.5 text-xs font-semibold" [class]="classePaiement(p.statut)">{{ libellePaiement(p.statut) }}</span></td>
                      <td class="px-5 py-3 text-right">
                        @if (p.quittance) {
                          <button (click)="quittance(p)" class="font-semibold text-neon-bleu hover:underline">📄 {{ p.quittance }}</button>
                        } @else { <span class="text-xs text-slate-600">—</span> }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="px-5 py-8 text-center text-slate-500">Aucun paiement pour ce logement.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <!-- ===== Signalements ===== -->
          @if (d.signalements?.length) {
            <section class="mt-8">
              <h2 class="text-lg font-bold text-white">Signalements · <span class="text-neon-bleu">{{ b.bien?.titre }}</span></h2>
              <div class="mt-4 space-y-2">
                @for (s of d.signalements; track s.id) {
                  <div class="flex flex-wrap items-center gap-3 rounded-xl border border-noir-600 bg-noir-800/60 px-4 py-3 text-sm">
                    <span class="font-mono text-xs text-slate-500">{{ s.numero }}</span>
                    <span class="flex-1 font-semibold text-white">{{ s.titre }}</span>
                    @if (s.prochaine_visite) { <span class="text-amber-300">👁 Technicien le {{ dateHeure(s.prochaine_visite) }}</span> }
                    <span class="rounded-full border px-2.5 py-0.5 text-xs font-semibold" [class]="classeSignalement(s.statut)">{{ libelleSignalement(s.statut) }}</span>
                  </div>
                }
              </div>
            </section>
          }
        }
      }
    </div>
  </div>

  <!-- ===================== Fenêtre : déclarer un paiement ===================== -->
  @if (fenetre() === 'paiement') {
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="fenetre.set(null)">
      <div class="w-full max-w-md rounded-2xl border border-neon-bleu/50 bg-noir-800 p-6 glow-bleu" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-white">Déclarer un paiement</h2>
        <p class="mt-1 text-sm text-slate-400">Le comptable vérifie sur son relevé, puis votre quittance apparaît ici.</p>
        <div class="mt-5 grid gap-4">

          <!-- 1. La location -->
          @if (locationsEnCours().length > 1) {
            <label class="text-sm text-slate-300">Location concernée *
              <select [ngModel]="fp.bail_id" (ngModelChange)="changerLocationPaiement($event)" [class]="champ + ' mt-1.5 w-full'">
                @for (l of locationsEnCours(); track l.id) {
                  <option [ngValue]="l.id">{{ l.bien }} — {{ l.numero }}{{ l.nb_retard ? ' (' + l.nb_retard + ' en retard)' : '' }}</option>
                }
              </select>
            </label>
          } @else {
            <p class="rounded-xl border border-noir-600 bg-noir-900/60 px-4 py-2.5 text-sm text-slate-300">🏠 {{ t()?.bail?.bien?.titre }}</p>
          }

          <!-- 2. Le mois -->
          <label class="text-sm text-slate-300">Mois concerné *
            @if (chargement()) {
              <div class="mt-1.5 h-11 animate-pulse rounded-xl bg-noir-700"></div>
            } @else if (aPayer().length) {
              <select [(ngModel)]="fp.echeance_id" (ngModelChange)="ajusterMontant()" [class]="champ + ' mt-1.5 w-full capitalize'">
                @for (e of aPayer(); track e.id) { <option [ngValue]="e.id">{{ nomMois(e.mois) }} — reste {{ montant(e.reste_du - e.en_attente) }}</option> }
              </select>
            } @else {
              <p class="mt-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/5 px-4 py-2.5 text-emerald-300">Rien à payer pour cette location 🎉</p>
            }
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="text-sm text-slate-300">Montant *
              <input type="number" min="100" [(ngModel)]="fp.montant" [class]="champ + ' mt-1.5 w-full'" />
            </label>
            <label class="text-sm text-slate-300">Payé par *
              <select [(ngModel)]="fp.mode_paiement" [class]="champ + ' mt-1.5 w-full'">
                @for (m of modes; track m.valeur) { @if (m.valeur !== 'especes') { <option [value]="m.valeur">{{ m.libelle }}</option> } }
              </select>
            </label>
          </div>
          <label class="text-sm text-slate-300">Référence de la transaction *
            <input type="text" [(ngModel)]="fp.reference" placeholder="Ex. : WV2611ABCD (reçue par SMS)" [class]="champ + ' mt-1.5 w-full font-mono'" />
          </label>
          <label class="text-sm text-slate-300">Date du paiement *
            <input type="date" [(ngModel)]="fp.date_paiement" [max]="aujourdhui" [class]="champ + ' mt-1.5 w-full'" />
          </label>
          @if (erreurFenetre()) { <p class="text-sm text-neon-rouge">{{ erreurFenetre() }}</p> }
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button (click)="fenetre.set(null)" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 hover:bg-noir-700">Annuler</button>
          <button (click)="envoyer(declarer())" [disabled]="envoi() || chargement() || !aPayer().length"
                  class="rounded-xl bg-neon-bleu px-5 py-2.5 font-bold text-noir-950 hover:glow-bleu disabled:opacity-60">
            {{ envoi() ? 'Envoi…' : 'Déclarer' }}
          </button>
        </div>
      </div>
    </div>
  }

  <!-- ===================== Fenêtre : signaler une panne ===================== -->
  @if (fenetre() === 'signalement') {
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="fenetre.set(null)">
      <div class="w-full max-w-md rounded-2xl border border-neon-rouge/50 bg-noir-800 p-6 glow-rouge" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-white">Signaler une panne</h2>
        <div class="mt-5 grid gap-4">
          @if (locationsEnCours().length > 1) {
            <label class="text-sm text-slate-300">Logement concerné *
              <select [(ngModel)]="fs.bail_id" [class]="champ + ' mt-1.5 w-full'">
                @for (l of locationsEnCours(); track l.id) { <option [ngValue]="l.id">{{ l.bien }} — {{ l.quartier }}</option> }
              </select>
            </label>
          }
          <input type="text" [(ngModel)]="fs.titre" placeholder="Ex. : Fuite sous l'évier *" [class]="champ" />
          <div class="grid grid-cols-4 gap-2">
            @for (c of categories; track c.valeur) {
              <button type="button" (click)="fs.categorie = c.valeur" class="rounded-xl border p-2 text-center text-xs transition"
                      [class]="fs.categorie === c.valeur ? 'border-neon-bleu bg-neon-bleu/10 text-neon-bleu' : 'border-noir-600 text-slate-400'">
                <span class="block text-xl">{{ c.icone }}</span>{{ c.libelle }}
              </button>
            }
          </div>
          <div class="grid grid-cols-3 gap-2">
            @for (u of urgences; track u.valeur) {
              <button type="button" (click)="fs.urgence = u.valeur" class="rounded-xl border py-2 text-sm font-semibold"
                      [class]="fs.urgence === u.valeur ? 'border-neon-rouge bg-neon-rouge/10 text-neon-rouge' : 'border-noir-600 text-slate-400'">{{ u.libelle }}</button>
            }
          </div>
          <textarea rows="3" [(ngModel)]="fs.description" placeholder="Depuis quand ? Où exactement ?" [class]="champ"></textarea>
          @if (erreurFenetre()) { <p class="text-sm text-neon-rouge">{{ erreurFenetre() }}</p> }
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button (click)="fenetre.set(null)" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 hover:bg-noir-700">Annuler</button>
          <button (click)="envoyer(signaler())" [disabled]="envoi()" class="rounded-xl bg-neon-rouge px-5 py-2.5 font-bold text-white hover:glow-rouge disabled:opacity-60">
            {{ envoi() ? 'Envoi…' : 'Envoyer' }}
          </button>
        </div>
      </div>
    </div>
  }
  `,
})
export class EspaceLocataire implements OnInit {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/mon-espace/locataire`;

  t = signal<TableauLocataire | null>(null);
  chargement = signal(true);
  notification = signal<string | null>(null);
  erreur = signal<string | null>(null);
  fenetre = signal<'paiement' | 'signalement' | null>(null);
  envoi = signal(false);
  erreurFenetre = signal<string | null>(null);

  modes = MODES_PAIEMENT;
  categories = [
    { valeur: 'plomberie', libelle: 'Plomberie', icone: '🚰' }, { valeur: 'electricite', libelle: 'Électricité', icone: '⚡' },
    { valeur: 'climatisation', libelle: 'Clim', icone: '❄️' }, { valeur: 'serrurerie', libelle: 'Serrure', icone: '🔑' },
    { valeur: 'peinture', libelle: 'Peinture', icone: '🎨' }, { valeur: 'menuiserie', libelle: 'Menuiserie', icone: '🚪' },
    { valeur: 'autre', libelle: 'Autre', icone: '🔧' },
  ];
  urgences = [{ valeur: 'faible', libelle: 'Faible' }, { valeur: 'normale', libelle: 'Normale' }, { valeur: 'haute', libelle: 'Urgente' }];

  aujourdhui = new Date().toISOString().slice(0, 10);
  fp = { bail_id: 0, echeance_id: 0, montant: 0, mode_paiement: 'wave', reference: '', date_paiement: this.aujourdhui };
  fs = { bail_id: 0, titre: '', description: '', categorie: 'autre', urgence: 'normale' };

  champ = 'rounded-xl border border-noir-600 bg-noir-900 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

  /** Les locations où l'on peut encore payer ou signaler */
  locationsEnCours = computed(() => (this.t()?.baux ?? []).filter((l) => l.en_cours));

  /** Les mois restant à payer pour la location AFFICHÉE */
  aPayer = computed(() => (this.t()?.echeances ?? []).filter((e) => e.reste_du - e.en_attente > 0));

  ngOnInit(): void { this.charger(); }

  /** Charge l'espace ; avec un id, affiche cette location-là. */
  charger(bailId?: number, apres?: () => void): void {
    this.chargement.set(true);
    this.erreur.set(null);
    const params = bailId ? new HttpParams().set('bail_id', bailId) : undefined;
    this.http.get<TableauLocataire>(this.api, { params }).subscribe({
      next: (d) => { this.t.set(d); this.chargement.set(false); apres?.(); },
      error: () => { this.erreur.set('Chargement impossible.'); this.chargement.set(false); },
    });
  }

  // ----- Paiement -----
  ouvrirPaiement(e: EcheanceL | null): void {
    const d = this.t();
    if (!d?.bail) return;

    // « Régulariser » : si la location affichée est à jour, on va sur la première location en retard
    if (!e && !this.aPayer().length) {
      const enRetard = this.locationsEnCours().find((l) => l.nb_retard > 0);
      if (enRetard) { this.charger(enRetard.id, () => this.ouvrirPaiement(null)); return; }
    }

    const cible = e ?? this.aPayer()[0];
    this.fp = {
      bail_id: d.bail.id, echeance_id: cible?.id ?? 0, montant: cible ? cible.reste_du - cible.en_attente : 0,
      mode_paiement: 'wave', reference: '', date_paiement: this.aujourdhui,
    };
    this.erreurFenetre.set(null);
    this.fenetre.set('paiement');
  }

  /** Dans la fenêtre : on change de location → on recharge ses mois à payer */
  changerLocationPaiement(bailId: number): void {
    this.fp.bail_id = bailId;
    this.charger(bailId, () => {
      const premier = this.aPayer()[0];
      this.fp.echeance_id = premier?.id ?? 0;
      this.fp.montant = premier ? premier.reste_du - premier.en_attente : 0;
    });
  }

  ajusterMontant(): void {
    const e = this.aPayer().find((x) => x.id === this.fp.echeance_id);
    if (e) this.fp.montant = e.reste_du - e.en_attente;
  }

  declarer(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/paiements`, { ...this.fp, reference: this.fp.reference.trim() });
  }

  // ----- Signalement -----
  ouvrirSignalement(): void {
    this.fs = { bail_id: this.t()?.bail?.id ?? 0, titre: '', description: '', categorie: 'autre', urgence: 'normale' };
    this.erreurFenetre.set(null);
    this.fenetre.set('signalement');
  }

  signaler(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/signalements`, { ...this.fs, description: this.fs.description.trim() || null });
  }

  // ----- Envoi commun -----
  envoyer(requete: Observable<{ message: string }>): void {
    this.envoi.set(true);
    this.erreurFenetre.set(null);
    requete.subscribe({
      next: (r) => { this.envoi.set(false); this.fenetre.set(null); this.notification.set(r.message); this.charger(this.t()?.bail?.id); },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        const erreurs = e.error?.errors as Record<string, string[]> | undefined;
        this.erreurFenetre.set(erreurs ? Object.values(erreurs)[0]?.[0] : (e.error?.message ?? 'Une erreur est survenue.'));
      },
    });
  }

  quittance(p: PaiementL): void {
    this.http.get(`${this.api}/paiements/${p.id}/quittance`, { responseType: 'blob' }).subscribe({
      next: (f) => { const url = URL.createObjectURL(f); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60_000); },
      error: () => this.erreur.set('Quittance indisponible pour le moment.'),
    });
  }

  // ----- Affichage -----
  libelleEcheance(e: EcheanceL): string {
    if (e.reste_du <= 0) return 'Payé';
    if (e.en_attente > 0) return 'En vérification';
    if (e.en_retard) return 'En retard';
    if (e.reste_du < e.montant_du) return 'Partiel';
    return 'À venir';
  }
  classeEcheance(e: EcheanceL): string {
    if (e.reste_du <= 0) return 'border-emerald-400/50 bg-emerald-400/5';
    if (e.en_attente > 0) return 'border-neon-bleu/50 bg-neon-bleu/5';
    if (e.en_retard) return 'border-neon-rouge/60 bg-neon-rouge/10 glow-rouge';
    if (e.reste_du < e.montant_du) return 'border-amber-300/50 bg-amber-300/5';
    return 'border-noir-600 bg-noir-900/60';
  }
  couleurEcheance(e: EcheanceL): string {
    if (e.reste_du <= 0) return 'text-emerald-300';
    if (e.en_attente > 0) return 'text-neon-bleu';
    if (e.en_retard) return 'text-neon-rouge';
    if (e.reste_du < e.montant_du) return 'text-amber-300';
    return 'text-slate-500';
  }
  libellePaiement(s: string): string {
    return ({ declare: 'Déclaré', enregistre: 'En vérification', valide: 'Validé', annule: 'Annulé' } as Record<string, string>)[s] ?? s;
  }
  classePaiement(s: string): string {
    return s === 'valide' ? 'border-emerald-400/60 text-emerald-300' : s === 'annule' ? 'border-slate-500/60 text-slate-500 line-through' : 'border-neon-bleu/60 text-neon-bleu';
  }
  libelleSignalement(s: string): string {
    return ({ nouveau: 'Reçu', en_cours: 'En cours', resolu: 'Résolu', rejete: 'Clôturé' } as Record<string, string>)[s] ?? s;
  }
  classeSignalement(s: string): string {
    return s === 'resolu' ? 'border-emerald-400/60 text-emerald-300' : s === 'en_cours' ? 'border-amber-300/60 text-amber-300' : s === 'nouveau' ? 'border-neon-rouge/60 text-neon-rouge' : 'border-slate-500/60 text-slate-500';
  }
  libelleMode(m: string): string { return MODES_PAIEMENT.find((x) => x.valeur === m)?.libelle ?? m; }
  montant(v: number | string): string { return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v) || 0) + ' FCFA'; }
  date(v: string | null): string { return v ? new Date(v).toLocaleDateString('fr-FR') : '—'; }
  dateHeure(v: string): string { return new Date(v.replace(' ', 'T')).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); }
  nomMois(v: string): string { return new Date(v.slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); }
  moisCourt(v: string): string { return new Date(v.slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }); }
}