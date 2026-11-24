import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { Page } from '../../core/models/pagination.model';
import { HeroFond } from './hero-fond';
import { Agence, Annonce, CriteresRecherche, Filtres, PortailService } from '../../core/services/portail.service';

@Component({
  selector: 'app-vitrine',
  standalone: true,
  imports: [FormsModule, RouterLink, HeroFond],
  template: `
  <div class="min-h-screen bg-noir-950 text-slate-200">

    <!-- ======================= EN-TÊTE ======================= -->
    <header class="sticky top-0 z-40 border-b border-noir-600/60 bg-noir-950/80 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <a routerLink="/" class="leading-tight">
          <p class="text-[10px] font-semibold uppercase tracking-[0.35em] text-neon-rouge text-glow-rouge">Agence immobilière</p>
          <p class="text-xl font-extrabold text-white">Dalal <span class="text-neon-bleu text-glow-bleu">Immobilier</span></p>
        </a>
        <nav class="flex items-center gap-2 text-sm font-semibold sm:gap-6">
          <a href="#annonces" class="hidden text-slate-300 hover:text-neon-bleu sm:inline">Annonces</a>
          <a href="#contact" class="hidden text-slate-300 hover:text-neon-bleu sm:inline">Contact</a>
          @if (auth.estConnecte()) {
            <a [routerLink]="auth.routeAccueil()" class="rounded-xl bg-neon-bleu px-4 py-2 text-noir-950 transition hover:glow-bleu">Mon espace</a>
          } @else {
            <a routerLink="/connexion" class="rounded-xl border border-neon-bleu/60 px-4 py-2 text-neon-bleu transition hover:bg-neon-bleu/10 hover:glow-bleu">Espace client</a>
          }
        </nav>
      </div>
    </header>

    <!-- ======================= BANDEAU ======================= -->
         <section class="relative overflow-hidden">
      <!-- Photo du salon : éclairée par la souris -->
      <app-hero-fond />

      <!-- Grille et halos néon par-dessus la photo -->
      <div class="pointer-events-none absolute inset-0 opacity-30"
           style="background-image: linear-gradient(#00d9ff22 1px, transparent 1px), linear-gradient(90deg, #00d9ff22 1px, transparent 1px); background-size: 48px 48px; mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);"></div>
      <div class="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-neon-bleu/20 blur-3xl"></div>
      <div class="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-neon-rouge/20 blur-3xl"></div>

      <div class="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-20 text-center md:px-8 md:pt-28">
    <p class="text-xs font-bold uppercase tracking-[0.4em] text-neon-rouge text-glow-rouge animate-neon">Dalal · « accueillir » en wolof</p>
        <h1 class="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight text-white md:text-6xl">
          Ici, vous êtes <span class="text-neon-bleu text-glow-bleu">chez vous</span>.
        </h1>
        <p class="mx-auto mt-5 max-w-xl text-lg text-slate-400">
          Appartements, villas et studios à Dakar, vérifiés par notre équipe. Trouvez, visitez, emménagez.
        </p>

        <!-- Barre de recherche -->
        <form (ngSubmit)="rechercher()" class="mx-auto mt-10 grid max-w-5xl gap-3 rounded-2xl border border-neon-bleu/40 bg-noir-900/80 p-3 glow-bleu backdrop-blur md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <input type="search" name="recherche" [(ngModel)]="criteres.recherche" placeholder="Quartier, type de logement…" [class]="champ" />
          <select name="quartier" [(ngModel)]="criteres.quartier" [class]="champ">
            <option value="">Tous les quartiers</option>
            @for (q of filtres().quartiers; track q) { <option [value]="q">{{ q }}</option> }
          </select>
          <select name="type" [(ngModel)]="criteres.type" [class]="champ + ' capitalize'">
            <option value="">Tous les types</option>
            @for (t of filtres().types; track t) { <option [value]="t">{{ t }}</option> }
          </select>
          <select name="prix" [(ngModel)]="criteres.prix_max" [class]="champ">
            <option [ngValue]="null">Budget max.</option>
            @for (p of budgets; track p) { <option [ngValue]="p">≤ {{ montant(p) }}</option> }
          </select>
          <button type="submit" class="rounded-xl bg-neon-rouge px-6 py-3 font-bold text-white transition hover:glow-rouge">Rechercher</button>
        </form>

        <!-- Chiffres -->
        <div class="mx-auto mt-10 flex max-w-xl justify-center gap-10 text-sm">
          <div><p class="text-3xl font-extrabold text-white">{{ page()?.total ?? '—' }}</p><p class="text-slate-500">logements disponibles</p></div>
          <div><p class="text-3xl font-extrabold text-white">48 h</p><p class="text-slate-500">pour vous rappeler</p></div>
          <div><p class="text-3xl font-extrabold text-white">0</p><p class="text-slate-500">frais de dossier</p></div>
        </div>
      </div>
    </section>

    <!-- ======================= ANNONCES ======================= -->
    <section id="annonces" class="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 md:px-8">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="text-3xl font-extrabold text-white">Nos logements disponibles</h2>
          <p class="mt-1 text-slate-400">{{ page()?.total ?? 0 }} résultat(s){{ filtreActif() ? ' pour votre recherche' : '' }}</p>
        </div>
        @if (filtreActif()) {
          <button (click)="reinitialiser()" class="text-sm font-semibold text-neon-bleu hover:underline">✕ Effacer les filtres</button>
        }
      </div>

      <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        @if (chargement()) {
          @for (n of [1, 2, 3, 4, 5, 6]; track n) { <div class="h-96 animate-pulse rounded-2xl bg-noir-800"></div> }
        } @else {
          @for (a of page()?.data ?? []; track a.id) {
            <a [routerLink]="['/annonces', a.id]"
               class="group overflow-hidden rounded-2xl border border-noir-600 bg-noir-800/60 transition duration-300 hover:-translate-y-1.5 hover:border-neon-bleu/60 hover:glow-bleu">
              <div class="relative aspect-[4/3] overflow-hidden bg-noir-900">
                @if (a.photo_principale) {
                  <img [src]="a.photo_principale" [alt]="a.titre" loading="lazy"
                       class="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                } @else {
                  <div class="grid h-full place-items-center text-5xl text-noir-600">🏠</div>
                }
                <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-noir-950/90 to-transparent"></div>
                @if (a.type_bien) {
                  <span class="absolute left-3 top-3 rounded-full border border-neon-bleu/60 bg-noir-950/80 px-3 py-1 text-xs font-bold capitalize text-neon-bleu backdrop-blur">{{ a.type_bien }}</span>
                }
                <p class="absolute bottom-3 left-4 text-2xl font-extrabold text-white">
                  {{ montant(a.loyer) }}<span class="text-sm font-medium text-slate-300"> /mois</span>
                </p>
              </div>
              <div class="p-5">
                <h3 class="line-clamp-1 text-lg font-bold text-white group-hover:text-neon-bleu">{{ a.titre }}</h3>
                <p class="mt-1 text-sm text-slate-400">📍 {{ a.quartier || 'Dakar' }}</p>
                <div class="mt-4 flex gap-4 border-t border-noir-700 pt-4 text-sm text-slate-300">
                  @if (a.pieces) { <span>🛏 {{ a.pieces }} pièce{{ +a.pieces > 1 ? 's' : '' }}</span> }
                  @if (a.surface) { <span>📐 {{ a.surface }} m²</span> }
                  <span class="ml-auto font-mono text-xs text-slate-500">{{ a.reference }}</span>
                </div>
              </div>
            </a>
          } @empty {
            <div class="col-span-full rounded-2xl border border-noir-600 bg-noir-800/40 px-6 py-16 text-center">
              <p class="text-5xl">🔍</p>
              <p class="mt-4 text-lg font-semibold text-white">Aucun logement ne correspond pour le moment.</p>
              <p class="mt-1 text-slate-400">Élargissez vos critères, ou laissez-nous un message : nous vous prévenons dès qu'un logement se libère.</p>
            </div>
          }
        }
      </div>

      @if (page(); as pg) { @if (pg.last_page > 1) {
        <div class="mt-10 flex justify-center gap-2 text-sm">
          <button (click)="charger(pg.current_page - 1)" [disabled]="pg.current_page === 1" class="rounded-xl border border-noir-600 px-4 py-2 text-slate-300 hover:border-neon-bleu disabled:opacity-40">← Précédent</button>
          <span class="px-3 py-2 text-slate-400">Page {{ pg.current_page }} / {{ pg.last_page }}</span>
          <button (click)="charger(pg.current_page + 1)" [disabled]="pg.current_page === pg.last_page" class="rounded-xl border border-noir-600 px-4 py-2 text-slate-300 hover:border-neon-bleu disabled:opacity-40">Suivant →</button>
        </div>
      } }
    </section>

    <!-- ======================= POURQUOI NOUS ======================= -->
    <section class="border-y border-noir-600/60 bg-noir-900/50">
      <div class="mx-auto grid max-w-7xl gap-6 px-4 py-14 md:grid-cols-3 md:px-8">
        @for (atout of atouts; track atout.titre) {
          <div class="rounded-2xl border border-noir-600 bg-noir-800/40 p-6 transition hover:border-neon-rouge/50">
            <p class="text-3xl">{{ atout.icone }}</p>
            <h3 class="mt-3 text-lg font-bold text-white">{{ atout.titre }}</h3>
            <p class="mt-2 text-sm text-slate-400">{{ atout.texte }}</p>
          </div>
        }
      </div>
    </section>

    <!-- ======================= CONTACT ======================= -->
    <section id="contact" class="mx-auto grid max-w-7xl scroll-mt-24 gap-10 px-4 py-16 md:grid-cols-2 md:px-8">
      <div>
        <h2 class="text-3xl font-extrabold text-white">Une question ? <span class="text-neon-rouge text-glow-rouge">Écrivez-nous.</span></h2>
        <p class="mt-3 text-slate-400">Vous êtes propriétaire et souhaitez nous confier votre bien ? Vous cherchez un logement précis ? Notre équipe vous répond rapidement.</p>
        @if (agence(); as ag) {
          <ul class="mt-8 space-y-3 text-slate-300">
            <li>📍 {{ ag.adresse }}</li>
            @if (ag.telephone) { <li>📞 <a [href]="'tel:' + ag.telephone" class="hover:text-neon-bleu">{{ ag.telephone }}</a></li> }
            @if (ag.email) { <li>✉️ <a [href]="'mailto:' + ag.email" class="hover:text-neon-bleu">{{ ag.email }}</a></li> }
          </ul>
        }
      </div>

      <form (ngSubmit)="envoyerContact()" class="grid gap-4 rounded-2xl border border-noir-600 bg-noir-800/60 p-6">
        <input type="text" name="nom" [(ngModel)]="contact.nom" placeholder="Votre nom *" [class]="champ" />
        <div class="grid gap-4 sm:grid-cols-2">
          <input type="email" name="email" [(ngModel)]="contact.email" placeholder="E-mail" [class]="champ" />
          <input type="tel" name="tel" [(ngModel)]="contact.telephone" placeholder="Téléphone" [class]="champ" />
        </div>
        <input type="text" name="sujet" [(ngModel)]="contact.sujet" placeholder="Sujet" [class]="champ" />
        <textarea name="message" rows="4" [(ngModel)]="contact.message" placeholder="Votre message *" [class]="champ"></textarea>
        <!-- Piège à robots : invisible pour les humains -->
        <input type="text" name="site_web" [(ngModel)]="contact.site_web" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true" />

        @if (contactOk()) { <p class="rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">{{ contactOk() }}</p> }
        @if (contactErreur()) { <p class="text-sm text-neon-rouge">{{ contactErreur() }}</p> }

        <button type="submit" [disabled]="envoi()" class="rounded-xl bg-neon-bleu py-3 font-bold text-noir-950 transition hover:glow-bleu disabled:opacity-60">
          {{ envoi() ? 'Envoi…' : 'Envoyer le message' }}
        </button>
      </form>
    </section>

    <!-- ======================= PIED DE PAGE ======================= -->
    <footer class="border-t border-noir-600/60 py-8 text-center text-sm text-slate-500">
      <p>© {{ annee }} <span class="font-semibold text-white">Dalal <span class="text-neon-bleu">Immobilier</span></span> — Ici, vous êtes chez vous.</p>
    </footer>
  </div>
  `,
})
export class Vitrine implements OnInit {
  private service = inject(PortailService);
  auth = inject(AuthService);

  page = signal<Page<Annonce> | null>(null);
  filtres = signal<Filtres>({ quartiers: [], types: [] });
  agence = signal<Agence | null>(null);
  chargement = signal(true);

  envoi = signal(false);
  contactOk = signal<string | null>(null);
  contactErreur = signal<string | null>(null);

  criteres: CriteresRecherche = { recherche: '', quartier: '', type: '', prix_max: null };
  contact = { nom: '', email: '', telephone: '', sujet: '', message: '', site_web: '' };

  budgets = [100_000, 200_000, 300_000, 500_000, 800_000, 1_500_000];
  annee = new Date().getFullYear();

  atouts = [
    { icone: '🔎', titre: 'Logements vérifiés', texte: 'Chaque bien est visité et photographié par notre équipe avant publication.' },
    { icone: '📄', titre: 'Contrat clair', texte: 'Bail, quittances et état des lieux remis en PDF : tout est traçable.' },
    { icone: '🛠️', titre: 'Suivi après l’emménagement', texte: 'Une panne ? Signalez-la, nous envoyons un technicien.' },
  ];

  champ = 'w-full rounded-xl border border-noir-600 bg-noir-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

  ngOnInit(): void {
    this.service.filtres().subscribe({ next: (f) => this.filtres.set(f) });
    this.service.agence().subscribe({ next: (a) => this.agence.set(a) });
    this.charger(1);
  }

  charger(numero: number): void {
    this.chargement.set(true);
    this.service.annonces(numero, this.criteres).subscribe({
      next: (p) => { this.page.set(p); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  rechercher(): void {
    this.charger(1);
    document.getElementById('annonces')?.scrollIntoView({ behavior: 'smooth' });
  }

  reinitialiser(): void {
    this.criteres = { recherche: '', quartier: '', type: '', prix_max: null };
    this.charger(1);
  }

  filtreActif(): boolean {
    const c = this.criteres;
    return !!(c.recherche || c.quartier || c.type || c.prix_max);
  }

  envoyerContact(): void {
    this.envoi.set(true);
    this.contactOk.set(null);
    this.contactErreur.set(null);
    const c = this.contact;
    this.service.contacter({
      nom: c.nom, email: c.email.trim() || null, telephone: c.telephone.trim() || null,
      sujet: c.sujet.trim() || null, message: c.message, site_web: c.site_web,
    }).subscribe({
      next: (r) => {
        this.envoi.set(false);
        this.contactOk.set(r.message);
        this.contact = { nom: '', email: '', telephone: '', sujet: '', message: '', site_web: '' };
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        const erreurs = e.error?.errors as Record<string, string[]> | undefined;
        this.contactErreur.set(e.status === 429
          ? 'Trop d’envois en peu de temps. Réessayez dans une minute.'
          : erreurs ? Object.values(erreurs)[0]?.[0] : (e.error?.message ?? 'Envoi impossible.'));
      },
    });
  }

  montant(v: number | string): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v) || 0) + ' FCFA';
  }
}