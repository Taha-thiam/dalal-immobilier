import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../../core/models/pagination.model';
import { AuthService } from '../../core/services/auth.service';

interface Compte { id: number; nom: string; prenom: string; email: string; telephone: string | null; role: string; statut: string }
interface Demande { id: number; email: string; statut: string; created_at: string; traite_le: string | null; user: Compte | null; traite_par: { nom: string; prenom: string } | null }

const ROLES: Record<string, { libelle: string; classe: string }> = {
  administrateur: { libelle: 'Administrateur', classe: 'border-neon-rouge/60 text-neon-rouge' },
  gestionnaire: { libelle: 'Gestionnaire', classe: 'border-neon-bleu/60 text-neon-bleu' },
  comptable: { libelle: 'Comptable', classe: 'border-amber-300/60 text-amber-300' },
  proprietaire: { libelle: 'Propriétaire', classe: 'border-emerald-400/60 text-emerald-300' },
  locataire: { libelle: 'Locataire', classe: 'border-violet-400/60 text-violet-300' },
};

@Component({
  selector: 'app-mots-de-passe',
  standalone: true,
  imports: [FormsModule],
  template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-6xl">
      <h1 class="text-3xl font-extrabold text-white">Mots de passe et accès</h1>
      <p class="mt-1 text-slate-400">Traitez les demandes « mot de passe oublié », réinitialisez et activez/désactivez n'importe quel compte.</p>

      <!-- Onglets -->
      <div class="mt-6 flex gap-2 border-b border-noir-600">
        <button (click)="changerOnglet('demandes')" class="-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition"
                [class]="onglet() === 'demandes' ? 'border-neon-bleu text-neon-bleu text-glow-bleu' : 'border-transparent text-slate-400 hover:text-white'">
          Demandes reçues
          @if (enAttente() > 0) { <span class="rounded-full bg-neon-rouge px-2 py-0.5 text-xs font-bold text-white">{{ enAttente() }}</span> }
        </button>
        <button (click)="changerOnglet('comptes')" class="-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition"
                [class]="onglet() === 'comptes' ? 'border-neon-bleu text-neon-bleu text-glow-bleu' : 'border-transparent text-slate-400 hover:text-white'">
          Tous les comptes
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

      <!-- Le mot de passe à communiquer -->
      @if (resultat(); as r) {
        <div class="mt-6 rounded-2xl border border-emerald-400/60 bg-emerald-400/10 p-5">
          <p class="text-sm font-semibold text-emerald-300">✅ Nouveau mot de passe de {{ r.pour }} — communiquez-le par téléphone :</p>
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <code class="rounded-xl bg-noir-950 px-4 py-2 font-mono text-xl font-bold tracking-wider text-white">{{ r.valeur }}</code>
            @if (r.telephone) { <a [href]="'tel:' + r.telephone" class="rounded-xl border border-neon-bleu/60 px-4 py-2 text-sm font-semibold text-neon-bleu hover:bg-neon-bleu/10">📞 {{ r.telephone }}</a> }
            <button (click)="resultat.set(null)" class="ml-auto text-sm text-slate-400 hover:text-white">Fermer</button>
          </div>
        </div>
      }

      <!-- =============== DEMANDES REÇUES =============== -->
      @if (onglet() === 'demandes') {
        <div class="mt-6 flex flex-wrap gap-2">
          @for (f of filtres; track f.valeur) {
            <button (click)="statut = f.valeur; chargerDemandes(1)" class="rounded-full border px-4 py-2 text-sm font-semibold transition"
                    [class]="statut === f.valeur ? 'border-neon-bleu bg-neon-bleu/10 text-neon-bleu glow-bleu' : 'border-noir-600 text-slate-400 hover:text-white'">
              {{ f.libelle }}
            </button>
          }
        </div>

        <div class="mt-4 space-y-3">
          @for (d of demandes()?.data ?? []; track d.id) {
            <article class="flex flex-wrap items-center gap-4 rounded-2xl border bg-noir-800/60 p-5"
                     [class]="d.statut === 'en_attente' ? 'border-neon-rouge/50 glow-rouge' : 'border-noir-600'">
              <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-neon-bleu/50 bg-neon-bleu/10 text-lg">🔑</div>
              <div class="min-w-56 flex-1">
                <p class="font-semibold text-white">{{ d.user?.prenom }} {{ d.user?.nom }}
                  @if (d.user) { <span class="ml-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold" [class]="roles[d.user.role]?.classe">{{ roles[d.user.role]?.libelle }}</span> }
                </p>
                <p class="text-xs text-slate-500">{{ d.email }} · demandé le {{ dateHeure(d.created_at) }}
                  @if (d.user?.telephone) { · 📞 {{ d.user?.telephone }} }</p>
                @if (d.statut !== 'en_attente') {
                  <p class="mt-1 text-xs" [class]="d.statut === 'traitee' ? 'text-emerald-300' : 'text-slate-500'">
                    {{ d.statut === 'traitee' ? 'Traitée' : 'Rejetée' }} le {{ dateHeure(d.traite_le) }}{{ d.traite_par ? ' par ' + d.traite_par.prenom : '' }}
                  </p>
                }
              </div>
              @if (d.statut === 'en_attente' && d.user) {
                <button (click)="reinitialiser(d.user, null)" class="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-noir-950 hover:bg-emerald-300">Remettre « passer »</button>
                <button (click)="ouvrirPerso(d.user)" class="rounded-xl border border-neon-bleu/60 px-4 py-2 text-sm font-semibold text-neon-bleu hover:bg-neon-bleu/10">Choisir un mot de passe</button>
                <button (click)="rejeter(d)" class="rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:text-neon-rouge">Rejeter</button>
              }
            </article>
          } @empty {
            <div class="rounded-2xl border border-emerald-400/40 bg-emerald-400/5 px-5 py-14 text-center">
              <p class="text-4xl">📭</p><p class="mt-3 font-semibold text-emerald-300">Aucune demande ici.</p>
            </div>
          }
        </div>
      }

      <!-- =============== TOUS LES COMPTES =============== -->
      @if (onglet() === 'comptes') {
        <input type="search" placeholder="Rechercher : nom, e-mail, téléphone…" (input)="recherche$.next($any($event.target).value)" [class]="champ + ' mt-6 w-full'" />
        <div class="mt-4 overflow-x-auto rounded-2xl border border-noir-600 bg-noir-800/60">
          <table class="w-full min-w-[820px] text-left text-sm">
            <thead class="border-b border-noir-600 text-xs uppercase tracking-wider text-slate-400">
              <tr><th class="px-5 py-3">Compte</th><th class="px-5 py-3">Rôle</th><th class="px-5 py-3">Statut</th><th class="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              @for (c of comptes()?.data ?? []; track c.id) {
                <tr class="border-b border-noir-700" [class.opacity-60]="c.statut !== 'actif'">
                                    <td class="px-5 py-3">
                    <p class="font-semibold text-white">{{ c.prenom }} {{ c.nom }} @if (c.id === moi()) { <span class="text-xs font-normal text-slate-500">(vous)</span> }</p>
                    <p class="text-xs text-slate-500">{{ c.email }}</p>
                  </td>
                  <td class="px-5 py-3"><span class="rounded-full border px-2.5 py-0.5 text-xs font-semibold" [class]="roles[c.role]?.classe">{{ roles[c.role]?.libelle ?? c.role }}</span></td>
                  <td class="px-5 py-3">
                    <span class="flex items-center gap-2 text-xs font-semibold" [class]="c.statut === 'actif' ? 'text-emerald-300' : 'text-slate-500'">
                      <span class="h-2 w-2 rounded-full" [class]="c.statut === 'actif' ? 'bg-emerald-400' : 'bg-slate-500'"></span>
                      {{ c.statut === 'actif' ? 'Actif' : 'Désactivé' }}
                    </span>
                  </td>
                                    <td class="px-5 py-3 text-right whitespace-nowrap">
                    @if (c.id === moi()) {
                      <span class="text-xs text-slate-500">Utilisez « Mon mot de passe »</span>
                    } @else {
                      <button (click)="reinitialiser(c, null)" class="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/10">« passer »</button>
                      <button (click)="ouvrirPerso(c)" class="rounded-lg px-3 py-1.5 text-xs font-semibold text-neon-bleu hover:bg-neon-bleu/10">Personnalisé</button>
                      <button (click)="basculerStatut(c)" class="rounded-lg px-3 py-1.5 text-xs font-semibold"
                              [class]="c.statut === 'actif' ? 'text-neon-rouge hover:bg-neon-rouge/10' : 'text-emerald-300 hover:bg-emerald-400/10'">
                        {{ c.statut === 'actif' ? 'Désactiver' : 'Réactiver' }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="px-5 py-10 text-center text-slate-500">Aucun compte trouvé.</td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (comptes(); as pg) { @if (pg.last_page > 1) {
          <div class="mt-4 flex justify-end gap-2 text-sm text-slate-400">
            <button (click)="chargerComptes(pg.current_page - 1)" [disabled]="pg.current_page === 1" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">← Précédent</button>
            <span class="px-2 py-1.5">Page {{ pg.current_page }} / {{ pg.last_page }}</span>
            <button (click)="chargerComptes(pg.current_page + 1)" [disabled]="pg.current_page === pg.last_page" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">Suivant →</button>
          </div>
        } }
      }
    </div>
  </div>

  <!-- Fenêtre : mot de passe choisi par l'admin -->
  @if (perso(); as c) {
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="perso.set(null)">
      <div class="w-full max-w-md rounded-2xl border border-neon-bleu/50 bg-noir-800 p-6 glow-bleu" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-white">Nouveau mot de passe</h2>
        <p class="mt-1 text-sm text-slate-400">Pour {{ c.prenom }} {{ c.nom }} ({{ c.email }})</p>
        <input type="text" [(ngModel)]="motPerso" placeholder="6 caractères minimum" [class]="champ + ' mt-5 w-full font-mono'" />
        @if (erreurFenetre()) { <p class="mt-2 text-sm text-neon-rouge">{{ erreurFenetre() }}</p> }
        <div class="mt-6 flex justify-end gap-3">
          <button (click)="perso.set(null)" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 hover:bg-noir-700">Annuler</button>
          <button (click)="reinitialiser(c, motPerso)" [disabled]="motPerso.length < 6" class="rounded-xl bg-neon-bleu px-5 py-2.5 font-bold text-noir-950 hover:glow-bleu disabled:opacity-50">Enregistrer</button>
        </div>
      </div>
    </div>
  }
  `,
})
export class MotsDePasse implements OnInit {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  private auth = inject(AuthService);

  /** id de l'administrateur connecté : pas d'action sur son propre compte */
  moi = () => this.auth.user()?.id;
  private api = `${environment.apiUrl}/admin`;

  roles = ROLES;
  filtres = [
    { valeur: 'en_attente', libelle: 'En attente' },
    { valeur: 'traitee', libelle: 'Traitées' },
    { valeur: 'rejetee', libelle: 'Rejetées' },
  ];

  onglet = signal<'demandes' | 'comptes'>('demandes');
  demandes = signal<Page<Demande> | null>(null);
  comptes = signal<Page<Compte> | null>(null);
  enAttente = signal(0);
  notification = signal<string | null>(null);
  erreur = signal<string | null>(null);
  resultat = signal<{ pour: string; valeur: string; telephone: string | null } | null>(null);
  perso = signal<Compte | null>(null);
  erreurFenetre = signal<string | null>(null);
  motPerso = '';

  statut = 'en_attente';
  private texte = '';
  recherche$ = new Subject<string>();

  champ = 'rounded-xl border border-noir-600 bg-noir-900 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

  ngOnInit(): void {
    this.recherche$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((t) => { this.texte = t; this.chargerComptes(1); });
    this.chargerDemandes(1);
  }

  changerOnglet(o: 'demandes' | 'comptes'): void {
    this.onglet.set(o);
    o === 'demandes' ? this.chargerDemandes(1) : this.chargerComptes(1);
  }

  chargerDemandes(page: number): void {
    const params = new HttpParams().set('page', page).set('statut', this.statut);
    this.http.get<Page<Demande>>(`${this.api}/demandes-mot-de-passe`, { params }).subscribe({
      next: (p) => this.demandes.set(p), error: () => this.erreur.set('Chargement impossible.'),
    });
    this.http.get<{ en_attente: number }>(`${this.api}/demandes-mot-de-passe/compteur`).subscribe({ next: (c) => this.enAttente.set(c.en_attente) });
  }

  chargerComptes(page: number): void {
    let params = new HttpParams().set('page', page);
    if (this.texte.trim()) params = params.set('recherche', this.texte.trim());
    this.http.get<Page<Compte>>(`${this.api}/utilisateurs`, { params }).subscribe({
      next: (p) => this.comptes.set(p), error: () => this.erreur.set('Chargement impossible.'),
    });
  }

  ouvrirPerso(c: Compte): void {
    this.motPerso = '';
    this.erreurFenetre.set(null);
    this.perso.set(c);
  }

  /** nouveau = null → mot de passe par défaut « passer » */
  reinitialiser(c: Compte, nouveau: string | null): void {
    this.http.post<{ message: string; mot_de_passe_temporaire: string }>(`${this.api}/utilisateurs/${c.id}/mot-de-passe`, nouveau ? { nouveau } : {}).subscribe({
      next: (r) => {
        this.perso.set(null);
        this.notification.set(r.message + ' Il a été déconnecté de tous ses appareils.');
        this.resultat.set({ pour: `${c.prenom} ${c.nom}`, valeur: r.mot_de_passe_temporaire, telephone: c.telephone });
        this.onglet() === 'demandes' ? this.chargerDemandes(1) : this.chargerComptes(this.comptes()?.current_page ?? 1);
      },
      error: (e: HttpErrorResponse) => {
        const erreurs = e.error?.errors as Record<string, string[]> | undefined;
        const msg = erreurs ? Object.values(erreurs)[0]?.[0] : (e.error?.message ?? 'Une erreur est survenue.');
        this.perso() ? this.erreurFenetre.set(msg) : this.erreur.set(msg);
      },
    });
  }

  /** Active / désactive n'importe quel compte (sauf le sien, refusé par le serveur) */
  basculerStatut(c: Compte): void {
    this.http.patch<{ message: string }>(`${this.api}/utilisateurs/${c.id}/statut`, {}).subscribe({
      next: (r) => { this.notification.set(r.message); this.chargerComptes(this.comptes()?.current_page ?? 1); },
      error: (e: HttpErrorResponse) => {
        const erreurs = e.error?.errors as Record<string, string[]> | undefined;
        this.erreur.set(erreurs ? Object.values(erreurs)[0]?.[0] : (e.error?.message ?? 'Une erreur est survenue.'));
      },
    });
  }

  rejeter(d: Demande): void {
    this.http.patch<{ message: string }>(`${this.api}/demandes-mot-de-passe/${d.id}/rejet`, {}).subscribe({
      next: (r) => { this.notification.set(r.message); this.chargerDemandes(1); },
      error: (e: HttpErrorResponse) => this.erreur.set(e.error?.message ?? 'Une erreur est survenue.'),
    });
  }

  dateHeure(v: string | null): string {
    return v ? new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  }
}