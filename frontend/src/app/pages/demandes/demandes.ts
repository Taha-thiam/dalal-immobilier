import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../../core/models/pagination.model';

type StatutDemande = 'nouvelle' | 'en_cours' | 'acceptee' | 'refusee';

interface Demande {
  id: number; numero: string; prenom: string; nom: string; telephone: string; email: string | null;
  profession: string | null; date_entree_souhaitee: string | null; message: string | null;
  statut: StatutDemande; date_visite: string | null; note_interne: string | null; motif_refus: string | null;
  created_at: string;
  bien: { id: number; titre: string; reference: string; quartier: string | null; statut: string } | null;
}

interface MessageContact {
  id: number; nom: string; email: string | null; telephone: string | null;
  sujet: string | null; message: string; lu: boolean; created_at: string;
}

type Fenetre = { type: 'visite' | 'accepter' | 'refuser'; d: Demande } | null;

const STATUTS: Record<StatutDemande, { libelle: string; classe: string }> = {
  nouvelle: { libelle: 'Nouvelle', classe: 'border-neon-rouge/60 bg-neon-rouge/10 text-neon-rouge' },
  en_cours: { libelle: 'Visite prévue', classe: 'border-amber-300/60 bg-amber-300/10 text-amber-300' },
  acceptee: { libelle: 'Acceptée', classe: 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' },
  refusee:  { libelle: 'Refusée', classe: 'border-slate-500/60 text-slate-500' },
};

@Component({
  selector: 'app-demandes',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-7xl">

      <h1 class="text-3xl font-extrabold text-white">Demandes</h1>
      <p class="mt-1 text-slate-400">Ce qui arrive du site public : demandes de location et messages de contact.</p>

      <!-- Onglets -->
      <div class="mt-6 flex gap-2 border-b border-noir-600">
        <button (click)="changerOnglet('demandes')" class="-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition"
                [class]="onglet() === 'demandes' ? 'border-neon-bleu text-neon-bleu text-glow-bleu' : 'border-transparent text-slate-400 hover:text-white'">
          Demandes de location
          @if (compteur().demandes > 0) { <span class="rounded-full bg-neon-rouge px-2 py-0.5 text-xs font-bold text-white">{{ compteur().demandes }}</span> }
        </button>
        <button (click)="changerOnglet('messages')" class="-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition"
                [class]="onglet() === 'messages' ? 'border-neon-bleu text-neon-bleu text-glow-bleu' : 'border-transparent text-slate-400 hover:text-white'">
          Messages de contact
          @if (compteur().messages > 0) { <span class="rounded-full bg-neon-rouge px-2 py-0.5 text-xs font-bold text-white">{{ compteur().messages }}</span> }
        </button>
      </div>

      @if (notification()) {
        <div class="mt-6 flex items-start justify-between gap-4 rounded-xl border border-neon-bleu/50 bg-neon-bleu/10 px-4 py-3 text-sm text-neon-bleu">
          <span>{{ notification() }}</span><button (click)="notification.set(null)" class="text-lg leading-none">×</button>
        </div>
      }
      @if (erreur()) {
        <div class="mt-6 flex items-start justify-between gap-4 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">
          <span>{{ erreur() }}</span><button (click)="erreur.set(null)" class="text-lg leading-none">×</button>
        </div>
      }

      <!-- =============== DEMANDES =============== -->
      @if (onglet() === 'demandes') {
        <div class="mt-6 flex flex-wrap gap-2">
          @for (f of filtres; track f.valeur) {
            <button (click)="statut = f.valeur; charger(1)" class="rounded-full border px-4 py-2 text-sm font-semibold transition"
                    [class]="statut === f.valeur ? 'border-neon-bleu bg-neon-bleu/10 text-neon-bleu glow-bleu' : 'border-noir-600 text-slate-400 hover:text-white'">
              {{ f.libelle }}
            </button>
          }
          <input type="search" placeholder="Nom, téléphone, n° DEM, bien…" (input)="recherche$.next($any($event.target).value)"
                 [class]="champ + ' min-w-64 flex-1'" />
        </div>

        <div class="mt-6 grid gap-4 lg:grid-cols-2">
          @if (chargement()) {
            @for (n of [1, 2]; track n) { <div class="h-56 animate-pulse rounded-2xl bg-noir-800"></div> }
          } @else {
            @for (d of demandes()?.data ?? []; track d.id) {
              <article class="rounded-2xl border bg-noir-800/60 p-5"
                       [class]="d.statut === 'nouvelle' ? 'border-neon-rouge/50 glow-rouge' : 'border-noir-600'">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-lg font-bold text-white">{{ d.prenom }} {{ d.nom }}</p>
                    <p class="text-xs text-slate-500"><span class="font-mono">{{ d.numero }}</span> · reçue le {{ date(d.created_at) }}</p>
                  </div>
                  <span class="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold" [class]="statuts[d.statut].classe">{{ statuts[d.statut].libelle }}</span>
                </div>

                <a [routerLink]="['/gestion/biens', d.bien?.id]" class="mt-3 block rounded-xl border border-noir-700 bg-noir-900/60 px-3 py-2 text-sm hover:border-neon-bleu/50">
                  🏠 <span class="font-semibold text-neon-bleu">{{ d.bien?.reference }}</span> — {{ d.bien?.titre }}
                  @if (d.bien?.statut === 'loue') { <span class="ml-1 text-xs text-neon-rouge">(déjà loué)</span> }
                </a>

                <div class="mt-3 grid gap-1 text-sm text-slate-300">
                  <p>📞 <a [href]="'tel:' + d.telephone" class="text-neon-bleu hover:underline">{{ d.telephone }}</a>
                    @if (d.email) { · ✉️ <a [href]="'mailto:' + d.email" class="hover:text-neon-bleu">{{ d.email }}</a> }</p>
                  @if (d.profession) { <p>💼 {{ d.profession }}</p> }
                  @if (d.date_entree_souhaitee) { <p>📅 Entrée souhaitée : {{ date(d.date_entree_souhaitee) }}</p> }
                  @if (d.date_visite) { <p class="text-amber-300">👁 Visite : {{ dateHeure(d.date_visite) }}</p> }
                </div>
                @if (d.message) { <p class="mt-3 rounded-xl bg-noir-900/60 p-3 text-sm italic text-slate-400">« {{ d.message }} »</p> }
                @if (d.note_interne) { <p class="mt-2 text-xs text-slate-500">Note : {{ d.note_interne }}</p> }
                @if (d.motif_refus) { <p class="mt-2 text-xs text-slate-500">Refus : {{ d.motif_refus }}</p> }

                @if (d.statut === 'nouvelle' || d.statut === 'en_cours') {
                  <div class="mt-4 flex flex-wrap gap-2 border-t border-noir-700 pt-4">
                    <button (click)="ouvrir('visite', d)" class="rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-noir-950 hover:bg-amber-200">
                      {{ d.date_visite ? 'Changer la visite' : 'Planifier une visite' }}
                    </button>
                    <button (click)="ouvrir('accepter', d)" class="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-noir-950 hover:bg-emerald-300">Accepter</button>
                    <button (click)="ouvrir('refuser', d)" class="rounded-xl px-4 py-2 text-sm font-semibold text-neon-rouge hover:bg-neon-rouge/10">Refuser</button>
                  </div>
                }
                @if (d.statut === 'acceptee') {
                  <div class="mt-4 flex flex-wrap items-center gap-3 border-t border-noir-700 pt-4">
                    <button (click)="copier(d)" class="rounded-xl border border-neon-bleu/60 px-4 py-2 text-sm font-semibold text-neon-bleu hover:bg-neon-bleu/10">📋 Copier les coordonnées</button>
                    <a routerLink="/gestion/locataires" class="rounded-xl bg-neon-bleu px-4 py-2 text-sm font-bold text-noir-950 hover:glow-bleu">Créer le locataire →</a>
                  </div>
                }
              </article>
            } @empty {
              <div class="col-span-full rounded-2xl border border-emerald-400/40 bg-emerald-400/5 px-5 py-14 text-center">
                <p class="text-4xl">📭</p><p class="mt-3 font-semibold text-emerald-300">Aucune demande ici.</p>
              </div>
            }
          }
        </div>
        @if (demandes(); as pg) { @if (pg.last_page > 1) {
          <div class="mt-4 flex justify-end gap-2 text-sm text-slate-400">
            <button (click)="charger(pg.current_page - 1)" [disabled]="pg.current_page === 1" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">← Précédent</button>
            <span class="px-2 py-1.5">Page {{ pg.current_page }} / {{ pg.last_page }}</span>
            <button (click)="charger(pg.current_page + 1)" [disabled]="pg.current_page === pg.last_page" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">Suivant →</button>
          </div>
        } }
      }

      <!-- =============== MESSAGES =============== -->
      @if (onglet() === 'messages') {
        <div class="mt-6 space-y-3">
          @for (m of messages()?.data ?? []; track m.id) {
            <article class="rounded-2xl border bg-noir-800/60 p-5" [class]="m.lu ? 'border-noir-600 opacity-70' : 'border-neon-bleu/50'">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="font-bold text-white">{{ m.nom }} @if (!m.lu) { <span class="ml-1 text-xs text-neon-rouge">● nouveau</span> }</p>
                  <p class="text-xs text-slate-500">{{ date(m.created_at) }}
                    @if (m.telephone) { · <a [href]="'tel:' + m.telephone" class="text-neon-bleu">{{ m.telephone }}</a> }
                    @if (m.email) { · <a [href]="'mailto:' + m.email" class="text-neon-bleu">{{ m.email }}</a> }</p>
                </div>
                @if (!m.lu) { <button (click)="marquerLu(m)" class="rounded-lg border border-noir-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-noir-700">Marquer lu</button> }
              </div>
              @if (m.sujet) { <p class="mt-3 font-semibold text-slate-200">{{ m.sujet }}</p> }
              <p class="mt-1 whitespace-pre-line text-sm text-slate-300">{{ m.message }}</p>
            </article>
          } @empty {
            <div class="rounded-2xl border border-noir-600 px-5 py-14 text-center text-slate-500">Aucun message.</div>
          }
        </div>
      }
    </div>
  </div>

  <!-- =============== Fenêtre =============== -->
  @if (fenetre(); as f) {
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="fenetre.set(null)">
      <div class="w-full max-w-md rounded-2xl border border-neon-bleu/40 bg-noir-800 p-6" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-white">
          {{ f.type === 'visite' ? 'Planifier la visite' : f.type === 'accepter' ? 'Accepter la demande' : 'Refuser la demande' }}
        </h2>
        <p class="mt-1 text-sm text-slate-400">{{ f.d.prenom }} {{ f.d.nom }} · {{ f.d.bien?.titre }}</p>

        <div class="mt-5 grid gap-4">
          @if (f.type === 'visite') {
            <label class="text-sm text-slate-300">Date et heure *
              <input type="datetime-local" [(ngModel)]="form.date_visite" [class]="champ + ' mt-1.5 w-full'" />
            </label>
          }
          @if (f.type === 'refuser') {
            <label class="text-sm text-slate-300">Motif du refus *
              <textarea rows="3" [(ngModel)]="form.motif_refus" placeholder="Ex. : logement attribué à un autre candidat" [class]="champ + ' mt-1.5 w-full'"></textarea>
            </label>
          } @else {
            <label class="text-sm text-slate-300">Note interne
              <textarea rows="2" [(ngModel)]="form.note_interne" placeholder="Ex. : salarié CDI, revenus OK" [class]="champ + ' mt-1.5 w-full'"></textarea>
            </label>
          }
          @if (erreurFenetre()) { <p class="text-sm text-neon-rouge">{{ erreurFenetre() }}</p> }
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button (click)="fenetre.set(null)" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 hover:bg-noir-700">Annuler</button>
          <button (click)="confirmer(f)" [disabled]="envoi()" class="rounded-xl bg-neon-bleu px-5 py-2.5 font-bold text-noir-950 hover:glow-bleu disabled:opacity-60">
            {{ envoi() ? 'Envoi…' : 'Confirmer' }}
          </button>
        </div>
      </div>
    </div>
  }
  `,
})
export class Demandes implements OnInit {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  private api = environment.apiUrl;

  statuts = STATUTS;
  filtres = [
    { valeur: 'ouvertes', libelle: 'À traiter' },
    { valeur: '', libelle: 'Toutes' },
    { valeur: 'acceptee', libelle: 'Acceptées' },
    { valeur: 'refusee', libelle: 'Refusées' },
  ];

  onglet = signal<'demandes' | 'messages'>('demandes');
  demandes = signal<Page<Demande> | null>(null);
  messages = signal<Page<MessageContact> | null>(null);
  compteur = signal({ demandes: 0, messages: 0 });
  chargement = signal(true);
  notification = signal<string | null>(null);
  erreur = signal<string | null>(null);

  fenetre = signal<Fenetre>(null);
  envoi = signal(false);
  erreurFenetre = signal<string | null>(null);
  form = { date_visite: '', note_interne: '', motif_refus: '' };

  statut = 'ouvertes';
  private texte = '';
  recherche$ = new Subject<string>();

  champ = 'rounded-xl border border-noir-600 bg-noir-900 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

  ngOnInit(): void {
    this.recherche$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((t) => { this.texte = t; this.charger(1); });
    this.charger(1);
  }

  changerOnglet(o: 'demandes' | 'messages'): void {
    this.onglet.set(o);
    o === 'demandes' ? this.charger(1) : this.chargerMessages();
  }

  charger(page: number): void {
    this.chargement.set(true);
    let params = new HttpParams().set('page', page);
    if (this.statut) params = params.set('statut', this.statut);
    if (this.texte.trim()) params = params.set('recherche', this.texte.trim());
    this.http.get<Page<Demande>>(`${this.api}/demandes`, { params }).subscribe({
      next: (p) => { this.demandes.set(p); this.chargement.set(false); },
      error: () => { this.erreur.set('Chargement impossible.'); this.chargement.set(false); },
    });
    this.chargerCompteur();
  }

  chargerMessages(): void {
    this.http.get<Page<MessageContact>>(`${this.api}/messages-contact`).subscribe({
      next: (p) => this.messages.set(p),
      error: () => this.erreur.set('Chargement impossible.'),
    });
    this.chargerCompteur();
  }

  private chargerCompteur(): void {
    this.http.get<{ demandes: number; messages: number }>(`${this.api}/demandes/compteur`)
      .subscribe({ next: (c) => this.compteur.set(c) });
  }

  ouvrir(type: 'visite' | 'accepter' | 'refuser', d: Demande): void {
    const demain = new Date(Date.now() + 86_400_000);
    demain.setHours(10, 0, 0, 0);
    const local = new Date(demain.getTime() - demain.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    this.form = { date_visite: d.date_visite ? d.date_visite.replace(' ', 'T').slice(0, 16) : local, note_interne: d.note_interne ?? '', motif_refus: '' };
    this.erreurFenetre.set(null);
    this.fenetre.set({ type, d });
  }

  confirmer(f: NonNullable<Fenetre>): void {
    const url = `${this.api}/demandes/${f.d.id}`;
    let requete: Observable<{ message: string }>;
    if (f.type === 'visite') {
      requete = this.http.patch<{ message: string }>(`${url}/visite`, { date_visite: this.form.date_visite.replace('T', ' '), note_interne: this.form.note_interne || null });
    } else if (f.type === 'accepter') {
      requete = this.http.patch<{ message: string }>(`${url}/acceptation`, { note_interne: this.form.note_interne || null });
    } else {
      requete = this.http.patch<{ message: string }>(`${url}/refus`, { motif_refus: this.form.motif_refus.trim() });
    }

    this.envoi.set(true);
    requete.subscribe({
      next: (r) => { this.envoi.set(false); this.fenetre.set(null); this.notification.set(r.message); this.charger(this.demandes()?.current_page ?? 1); },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        const erreurs = e.error?.errors as Record<string, string[]> | undefined;
        this.erreurFenetre.set(erreurs ? Object.values(erreurs)[0]?.[0] : (e.error?.message ?? 'Une erreur est survenue.'));
      },
    });
  }

  marquerLu(m: MessageContact): void {
    this.http.patch(`${this.api}/messages-contact/${m.id}/lu`, {}).subscribe({ next: () => this.chargerMessages() });
  }

  /** Copie nom, téléphone et e-mail pour les coller dans le formulaire « Nouveau locataire ». */
  copier(d: Demande): void {
    const texte = `${d.prenom} ${d.nom}\n${d.telephone}\n${d.email ?? ''}`;
    navigator.clipboard.writeText(texte).then(() => this.notification.set('Coordonnées copiées : collez-les dans « Nouveau locataire ».'));
  }

  date(v: string | null): string { return v ? new Date(v).toLocaleDateString('fr-FR') : '—'; }
  dateHeure(v: string): string { return new Date(v.replace(' ', 'T')).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); }
}