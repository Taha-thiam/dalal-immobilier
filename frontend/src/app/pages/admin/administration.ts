import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { Page } from '../../core/models/pagination.model';

type Onglet = 'personnel' | 'parametres' | 'journal';

interface Compte { id: number; nom: string; prenom: string; email: string; telephone: string | null; role: string; statut: string; matricule: string | null; created_at: string }
interface Ligne { id: number; created_at: string; action?: string; description?: string; ip?: string; auteur: { nom: string; role: string } | null;[cle: string]: unknown }

/** Champs de paramètres connus : affichés seulement s'ils existent dans la table. */
const CHAMPS: { cle: string; libelle: string; type: 'text' | 'email' | 'number' }[] = [
    { cle: 'nom', libelle: "Nom de l'agence", type: 'text' },
    { cle: 'adresse', libelle: 'Adresse', type: 'text' },
    { cle: 'ville', libelle: 'Ville', type: 'text' },
    { cle: 'telephone', libelle: 'Téléphone', type: 'text' },
    { cle: 'email', libelle: 'E-mail', type: 'email' },
    { cle: 'site_web', libelle: 'Site web', type: 'text' },
    { cle: 'ninea', libelle: 'NINEA', type: 'text' },
    { cle: 'rccm', libelle: 'RCCM', type: 'text' },
    { cle: 'taux_commission', libelle: 'Commission par défaut (%)', type: 'number' },
    { cle: 'commission_defaut', libelle: 'Commission par défaut (%)', type: 'number' },
    { cle: 'jour_echeance', libelle: "Jour d'échéance par défaut", type: 'number' },
    { cle: 'penalite_retard', libelle: 'Pénalité de retard (%)', type: 'number' },
];

const ROLES: Record<string, { libelle: string; classe: string }> = {
    administrateur: { libelle: 'Administrateur', classe: 'border-neon-rouge/60 text-neon-rouge' },
    gestionnaire: { libelle: 'Gestionnaire', classe: 'border-neon-bleu/60 text-neon-bleu' },
    comptable: { libelle: 'Comptable', classe: 'border-amber-300/60 text-amber-300' },
};

@Component({
    selector: 'app-administration',
    standalone: true,
    imports: [FormsModule],
    template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-6xl">
      <h1 class="text-3xl font-extrabold text-white">Administration</h1>
      <p class="mt-1 text-slate-400">Comptes du personnel, paramètres de l'agence et traçabilité.</p>

      <div class="mt-6 flex gap-2 border-b border-noir-600">
        @for (o of onglets; track o.cle) {
          <button (click)="aller(o.cle)" class="-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition"
                  [class]="onglet() === o.cle ? 'border-neon-bleu text-neon-bleu text-glow-bleu' : 'border-transparent text-slate-400 hover:text-white'">
            {{ o.libelle }}
          </button>
        }
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

      <!-- Mot de passe temporaire : affiché UNE seule fois -->
      @if (motDePasse(); as mdp) {
        <div class="mt-6 rounded-2xl border border-neon-rouge/60 bg-neon-rouge/10 p-5 glow-rouge">
          <p class="text-sm font-semibold text-neon-rouge">🔐 Mot de passe temporaire de {{ mdp.pour }} — notez-le maintenant, il ne sera plus affiché :</p>
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <code class="rounded-xl bg-noir-950 px-4 py-2 font-mono text-xl font-bold tracking-wider text-white">{{ mdp.valeur }}</code>
            <button (click)="copier(mdp.valeur)" class="rounded-xl border border-neon-bleu/60 px-4 py-2 text-sm font-semibold text-neon-bleu hover:bg-neon-bleu/10">📋 Copier</button>
            <button (click)="motDePasse.set(null)" class="ml-auto text-sm text-slate-400 hover:text-white">C'est noté ✓</button>
          </div>
        </div>
      }

      <!-- ===================== PERSONNEL ===================== -->
      @if (onglet() === 'personnel') {
        <div class="mt-6 flex justify-end">
          <button (click)="fenetre.set(true)" class="rounded-xl bg-neon-bleu px-5 py-2.5 font-bold text-noir-950 hover:glow-bleu">+ Nouveau compte</button>
        </div>
        <div class="mt-4 overflow-x-auto rounded-2xl border border-noir-600 bg-noir-800/60">
          <table class="w-full min-w-[760px] text-left text-sm">
            <thead class="border-b border-noir-600 text-xs uppercase tracking-wider text-slate-400">
              <tr><th class="px-5 py-3">Personne</th><th class="px-5 py-3">Rôle</th><th class="px-5 py-3">Matricule</th><th class="px-5 py-3">Statut</th><th class="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              @for (c of comptes(); track c.id) {
                <tr class="border-b border-noir-700" [class.opacity-50]="c.statut !== 'actif'">
                  <td class="px-5 py-3">
                    <p class="font-semibold text-white">{{ c.prenom }} {{ c.nom }} @if (c.id === moi()) { <span class="text-xs text-slate-500">(vous)</span> }</p>
                    <p class="text-xs text-slate-500">{{ c.email }}{{ c.telephone ? ' · ' + c.telephone : '' }}</p>
                  </td>
                  <td class="px-5 py-3"><span class="rounded-full border px-2.5 py-0.5 text-xs font-semibold" [class]="roles[c.role]?.classe">{{ roles[c.role]?.libelle ?? c.role }}</span></td>
                  <td class="px-5 py-3 font-mono text-slate-400">{{ c.matricule ?? '—' }}</td>
                  <td class="px-5 py-3">
                    <span class="flex items-center gap-2 text-xs font-semibold" [class]="c.statut === 'actif' ? 'text-emerald-300' : 'text-slate-500'">
                      <span class="h-2 w-2 rounded-full" [class]="c.statut === 'actif' ? 'bg-emerald-400' : 'bg-slate-500'"></span>
                      {{ c.statut === 'actif' ? 'Actif' : 'Désactivé' }}
                    </span>
                  </td>
                  <td class="px-5 py-3 text-right">
                    @if (c.id !== moi()) {
                      <button (click)="reinitialiser(c)" class="rounded-lg px-3 py-1.5 text-xs font-semibold text-neon-bleu hover:bg-neon-bleu/10">Nouveau mot de passe</button>
                      <button (click)="basculer(c)" class="rounded-lg px-3 py-1.5 text-xs font-semibold"
                              [class]="c.statut === 'actif' ? 'text-neon-rouge hover:bg-neon-rouge/10' : 'text-emerald-300 hover:bg-emerald-400/10'">
                        {{ c.statut === 'actif' ? 'Désactiver' : 'Réactiver' }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- ===================== PARAMÈTRES ===================== -->
      @if (onglet() === 'parametres') {
        <form (ngSubmit)="enregistrerParametres()" class="mt-6 rounded-2xl border border-noir-600 bg-noir-800/60 p-6">
          <div class="grid gap-4 sm:grid-cols-2">
            @for (c of champsPresents(); track c.cle) {
              <label class="text-sm text-slate-300">{{ c.libelle }}
                <input [type]="c.type" [name]="c.cle" [(ngModel)]="parametres[c.cle]" [class]="champ + ' mt-1.5 w-full'" />
              </label>
            }
          </div>
          <p class="mt-4 text-xs text-slate-500">Ces informations apparaissent sur les contrats, les quittances, les relevés et le site public.</p>
          <div class="mt-6 flex justify-end">
            <button type="submit" [disabled]="envoi()" class="rounded-xl bg-neon-bleu px-6 py-2.5 font-bold text-noir-950 hover:glow-bleu disabled:opacity-60">
              {{ envoi() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
          </div>
        </form>
      }

      <!-- ===================== JOURNAL ===================== -->
      @if (onglet() === 'journal') {
        <input type="search" placeholder="Rechercher une action…" (input)="recherche$.next($any($event.target).value)" [class]="champ + ' mt-6 w-full'" />
        <div class="mt-4 space-y-2">
          @for (l of journal()?.data ?? []; track l.id) {
            <div class="flex flex-wrap items-start gap-3 rounded-xl border border-noir-600 bg-noir-800/60 px-4 py-3 text-sm">
              <span class="w-36 shrink-0 font-mono text-xs text-slate-500">{{ dateHeure(l.created_at) }}</span>
              <span class="w-40 shrink-0 font-semibold" [class]="roles[l.auteur?.role ?? '']?.classe ?? 'text-slate-400'">{{ l.auteur?.nom ?? 'Système' }}</span>
              <span class="flex-1 text-slate-300">{{ l.description ?? l.action ?? '—' }}</span>
              @if (l.action) { <span class="rounded-full bg-noir-900 px-2 py-0.5 font-mono text-[11px] text-slate-500">{{ l.action }}</span> }
            </div>
          } @empty {
            <p class="rounded-xl border border-noir-600 px-5 py-10 text-center text-slate-500">Aucune activité enregistrée.</p>
          }
        </div>
        @if (journal(); as pg) { @if (pg.last_page > 1) {
          <div class="mt-4 flex justify-end gap-2 text-sm text-slate-400">
            <button (click)="chargerJournal(pg.current_page - 1)" [disabled]="pg.current_page === 1" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">← Précédent</button>
            <span class="px-2 py-1.5">Page {{ pg.current_page }} / {{ pg.last_page }}</span>
            <button (click)="chargerJournal(pg.current_page + 1)" [disabled]="pg.current_page === pg.last_page" class="rounded-lg border border-noir-600 px-3 py-1.5 disabled:opacity-40">Suivant →</button>
          </div>
        } }
      }
    </div>
  </div>

  <!-- Fenêtre : nouveau compte -->
  @if (fenetre()) {
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="fenetre.set(false)">
      <div class="w-full max-w-md rounded-2xl border border-neon-bleu/50 bg-noir-800 p-6 glow-bleu" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold text-white">Nouveau compte du personnel</h2>
        <div class="mt-5 grid gap-4">
          <div class="grid grid-cols-2 gap-3">
            <input [(ngModel)]="fc.prenom" placeholder="Prénom *" [class]="champ" />
            <input [(ngModel)]="fc.nom" placeholder="Nom *" [class]="champ" />
          </div>
          <input type="email" [(ngModel)]="fc.email" placeholder="E-mail *" [class]="champ" />
          <input type="tel" [(ngModel)]="fc.telephone" placeholder="Téléphone" [class]="champ" />
          <div class="grid grid-cols-3 gap-2">
            @for (r of ['gestionnaire', 'comptable', 'administrateur']; track r) {
              <button type="button" (click)="fc.role = r" class="rounded-xl border py-2 text-xs font-semibold transition"
                      [class]="fc.role === r ? 'border-neon-bleu bg-neon-bleu/10 text-neon-bleu' : 'border-noir-600 text-slate-400'">{{ roles[r].libelle }}</button>
            }
          </div>
          @if (erreurFenetre()) { <p class="text-sm text-neon-rouge">{{ erreurFenetre() }}</p> }
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button (click)="fenetre.set(false)" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 hover:bg-noir-700">Annuler</button>
          <button (click)="creer()" [disabled]="envoi()" class="rounded-xl bg-neon-bleu px-5 py-2.5 font-bold text-noir-950 hover:glow-bleu disabled:opacity-60">Créer</button>
        </div>
      </div>
    </div>
  }
  `,
})
export class Administration implements OnInit {
    private http = inject(HttpClient);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private auth = inject(AuthService);
    private destroyRef = inject(DestroyRef);
    private api = `${environment.apiUrl}/admin`;

    roles = ROLES;
    onglets: { cle: Onglet; libelle: string; lien: string }[] = [
        { cle: 'personnel', libelle: 'Personnel', lien: '/admin/comptes' },
        { cle: 'parametres', libelle: 'Paramètres', lien: '/admin/parametres' },
        { cle: 'journal', libelle: 'Journal', lien: '/admin/journal' },
    ];

    onglet = signal<Onglet>('personnel');
    comptes = signal<Compte[]>([]);
    journal = signal<Page<Ligne> | null>(null);
    champsPresents = signal<typeof CHAMPS>([]);
    parametres: Record<string, unknown> = {};

    notification = signal<string | null>(null);
    erreur = signal<string | null>(null);
    motDePasse = signal<{ pour: string; valeur: string } | null>(null);
    fenetre = signal(false);
    envoi = signal(false);
    erreurFenetre = signal<string | null>(null);

    fc = { prenom: '', nom: '', email: '', telephone: '', role: 'gestionnaire' };
    recherche$ = new Subject<string>();
    private texte = '';

    champ = 'rounded-xl border border-noir-600 bg-noir-900 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

    moi = () => this.auth.user()?.id;

    ngOnInit(): void {
        this.recherche$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
            .subscribe((t) => { this.texte = t; this.chargerJournal(1); });

        // L'onglet dépend de l'adresse (/admin/comptes, /admin/parametres, /admin/journal)
        this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((d) => {
            this.onglet.set((d['onglet'] as Onglet) ?? 'personnel');
            this.chargerOnglet();
        });
    }

    aller(o: Onglet): void {
        this.router.navigateByUrl(this.onglets.find((x) => x.cle === o)!.lien);
    }

    private chargerOnglet(): void {
        if (this.onglet() === 'personnel') this.chargerComptes();
        if (this.onglet() === 'parametres') this.chargerParametres();
        if (this.onglet() === 'journal') this.chargerJournal(1);
    }

    // ----- Personnel -----
    chargerComptes(): void {
        this.http.get<Compte[]>(`${this.api}/personnel`).subscribe({ next: (c) => this.comptes.set(c), error: () => this.erreur.set('Chargement impossible.') });
    }

    creer(): void {
        this.envoi.set(true);
        this.erreurFenetre.set(null);
        this.http.post<{ message: string; mot_de_passe_temporaire: string }>(`${this.api}/personnel`, { ...this.fc, telephone: this.fc.telephone || null }).subscribe({
            next: (r) => {
                this.envoi.set(false); this.fenetre.set(false);
                this.notification.set(r.message);
                this.motDePasse.set({ pour: `${this.fc.prenom} ${this.fc.nom}`, valeur: r.mot_de_passe_temporaire });
                this.fc = { prenom: '', nom: '', email: '', telephone: '', role: 'gestionnaire' };
                this.chargerComptes();
            },
            error: (e: HttpErrorResponse) => { this.envoi.set(false); this.erreurFenetre.set(this.messageErreur(e)); },
        });
    }

    basculer(c: Compte): void {
        this.http.patch<{ message: string }>(`${this.api}/personnel/${c.id}/statut`, {}).subscribe({
            next: (r) => { this.notification.set(r.message); this.chargerComptes(); },
            error: (e: HttpErrorResponse) => this.erreur.set(this.messageErreur(e)),
        });
    }

    reinitialiser(c: Compte): void {
        this.http.post<{ message: string; mot_de_passe_temporaire: string }>(`${this.api}/personnel/${c.id}/mot-de-passe`, {}).subscribe({
            next: (r) => { this.notification.set(r.message); this.motDePasse.set({ pour: `${c.prenom} ${c.nom}`, valeur: r.mot_de_passe_temporaire }); },
            error: (e: HttpErrorResponse) => this.erreur.set(this.messageErreur(e)),
        });
    }

    copier(v: string): void {
        navigator.clipboard.writeText(v).then(() => this.notification.set('Mot de passe copié.'));
    }

    // ----- Paramètres -----
    chargerParametres(): void {
        this.http.get<Record<string, unknown>>(`${this.api}/parametres`).subscribe({
            next: (p) => {
                this.parametres = { ...p };
                this.champsPresents.set(CHAMPS.filter((c) => c.cle in p));
            },
            error: () => this.erreur.set('Chargement impossible.'),
        });
    }

    enregistrerParametres(): void {
        const donnees: Record<string, unknown> = {};
        for (const c of this.champsPresents()) {
            const v = this.parametres[c.cle];
            donnees[c.cle] = v === '' ? null : v;
        }
        this.envoi.set(true);
        this.http.put<{ message: string }>(`${this.api}/parametres`, donnees).subscribe({
            next: (r) => { this.envoi.set(false); this.notification.set(r.message); },
            error: (e: HttpErrorResponse) => { this.envoi.set(false); this.erreur.set(this.messageErreur(e)); },
        });
    }

    // ----- Journal -----
    chargerJournal(page: number): void {
        let params = new HttpParams().set('page', page);
        if (this.texte.trim()) params = params.set('recherche', this.texte.trim());
        this.http.get<Page<Ligne>>(`${this.api}/journal`, { params }).subscribe({ next: (p) => this.journal.set(p), error: () => this.erreur.set('Chargement impossible.') });
    }

    private messageErreur(e: HttpErrorResponse): string {
        const erreurs = e.error?.errors as Record<string, string[]> | undefined;
        if (erreurs) return Object.values(erreurs)[0]?.[0] ?? 'Données invalides.';
        return e.error?.message ?? 'Une erreur est survenue.';
    }

    dateHeure(v: string): string { return new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); }
}