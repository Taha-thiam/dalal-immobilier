import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Annonce, PortailService } from '../../core/services/portail.service';

@Component({
    selector: 'app-annonce',
    standalone: true,
    imports: [FormsModule, RouterLink],
    template: `
  <div class="min-h-screen bg-noir-950 text-slate-200">

    <!-- En-tête -->
    <header class="sticky top-0 z-40 border-b border-noir-600/60 bg-noir-950/80 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <a routerLink="/" class="text-xl font-extrabold text-white">Dalal <span class="text-neon-bleu text-glow-bleu">Immobilier</span></a>
        <a routerLink="/" fragment="annonces" class="text-sm font-semibold text-slate-300 hover:text-neon-bleu">← Toutes les annonces</a>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-8 md:px-8">
      @if (chargement()) {
        <div class="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div class="aspect-[16/10] animate-pulse rounded-2xl bg-noir-800"></div>
          <div class="h-96 animate-pulse rounded-2xl bg-noir-800"></div>
        </div>
      } @else if (introuvable()) {
        <div class="mx-auto max-w-lg rounded-2xl border border-neon-rouge/40 bg-noir-800/60 p-10 text-center">
          <p class="text-5xl">🔑</p>
          <h1 class="mt-4 text-2xl font-bold text-white">Ce logement n'est plus disponible</h1>
          <p class="mt-2 text-slate-400">Il vient sans doute d'être loué. Découvrez nos autres annonces.</p>
          <a routerLink="/" class="mt-6 inline-block rounded-xl bg-neon-bleu px-6 py-3 font-bold text-noir-950 hover:glow-bleu">Voir les annonces</a>
        </div>
      } @else if (annonce(); as a) {

        <div class="grid gap-8 lg:grid-cols-[1fr_400px]">

          <!-- ===================== COLONNE GAUCHE ===================== -->
          <div>
            <!-- Galerie -->
            <div class="relative aspect-[16/10] overflow-hidden rounded-2xl border border-noir-600 bg-noir-900">
              @if (photoActive(); as url) {
                <img [src]="url" [alt]="a.titre" class="h-full w-full object-cover" />
              } @else {
                <div class="grid h-full place-items-center text-7xl text-noir-600">🏠</div>
              }
              @if (a.photos.length > 1) {
                <button (click)="defiler(-1)" aria-label="Photo précédente"
                        class="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-neon-bleu/50 bg-noir-950/70 text-xl text-neon-bleu backdrop-blur hover:glow-bleu">‹</button>
                <button (click)="defiler(1)" aria-label="Photo suivante"
                        class="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-neon-bleu/50 bg-noir-950/70 text-xl text-neon-bleu backdrop-blur hover:glow-bleu">›</button>
                <span class="absolute bottom-3 right-3 rounded-full bg-noir-950/80 px-3 py-1 text-xs text-slate-300">{{ index() + 1 }} / {{ a.photos.length }}</span>
              }
            </div>

            @if (a.photos.length > 1) {
              <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
                @for (p of a.photos; track p.id; let i = $index) {
                  <button (click)="index.set(i)" class="h-20 w-28 shrink-0 overflow-hidden rounded-xl border-2 transition"
                          [class]="i === index() ? 'border-neon-bleu glow-bleu' : 'border-transparent opacity-60 hover:opacity-100'">
                    <img [src]="p.url" alt="" class="h-full w-full object-cover" />
                  </button>
                }
              </div>
            }

            <!-- Titre -->
            <div class="mt-8">
              <div class="flex flex-wrap items-center gap-2">
                @if (a.type_bien) { <span class="rounded-full border border-neon-bleu/60 px-3 py-1 text-xs font-bold capitalize text-neon-bleu">{{ a.type_bien }}</span> }
                @if (a.meuble) { <span class="rounded-full border border-neon-rouge/60 px-3 py-1 text-xs font-bold text-neon-rouge">Meublé</span> }
                <span class="font-mono text-xs text-slate-500">{{ a.reference }}</span>
              </div>
              <h1 class="mt-3 text-3xl font-extrabold text-white md:text-4xl">{{ a.titre }}</h1>
              <p class="mt-2 text-slate-400">📍 {{ a.quartier || 'Dakar' }}{{ a.ville ? ', ' + a.ville : '' }}</p>
            </div>

            <!-- Caractéristiques -->
            <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              @for (c of caracteristiques(); track c.libelle) {
                <div class="rounded-2xl border border-noir-600 bg-noir-800/60 p-4 text-center">
                  <p class="text-2xl">{{ c.icone }}</p>
                  <p class="mt-1 text-lg font-bold text-white">{{ c.valeur }}</p>
                  <p class="text-xs text-slate-500">{{ c.libelle }}</p>
                </div>
              }
            </div>

            <!-- Description -->
            @if (a.description) {
              <section class="mt-8">
                <h2 class="text-lg font-bold text-white">Description</h2>
                <p class="mt-3 whitespace-pre-line leading-relaxed text-slate-300">{{ a.description }}</p>
              </section>
            }
          </div>

          <!-- ===================== COLONNE DROITE : DEMANDE ===================== -->
          <aside class="lg:sticky lg:top-24 lg:self-start">
            <div class="rounded-2xl border border-neon-bleu/40 bg-noir-800/80 p-6 glow-bleu">
              <p class="text-3xl font-extrabold text-white">{{ montant(a.loyer) }}<span class="text-base font-medium text-slate-400"> /mois</span></p>
              <dl class="mt-3 space-y-1 text-sm">
                @if (+(a.charges ?? 0) > 0) { <div class="flex justify-between"><dt class="text-slate-500">Charges</dt><dd>{{ montant(a.charges!) }}</dd></div> }
                @if (+(a.caution ?? 0) > 0) { <div class="flex justify-between"><dt class="text-slate-500">Caution</dt><dd>{{ montant(a.caution!) }}</dd></div> }
              </dl>

              @if (succes()) {
                <div class="mt-6 rounded-xl border border-emerald-400/50 bg-emerald-400/10 p-5 text-center">
                  <p class="text-4xl">✅</p>
                  <p class="mt-3 font-semibold text-emerald-300">{{ succes() }}</p>
                  <a routerLink="/" class="mt-4 inline-block text-sm font-semibold text-neon-bleu hover:underline">Voir d'autres logements</a>
                </div>
              } @else {
                <h2 class="mt-6 text-lg font-bold text-white">Ce logement vous intéresse ?</h2>
                <p class="text-sm text-slate-400">Laissez vos coordonnées : un conseiller vous rappelle pour organiser la visite.</p>

                <form (ngSubmit)="envoyer(a.id)" class="mt-5 grid gap-3">
                  <div class="grid grid-cols-2 gap-3">
                    <input name="prenom" [(ngModel)]="form.prenom" placeholder="Prénom *" [class]="champ" />
                    <input name="nom" [(ngModel)]="form.nom" placeholder="Nom *" [class]="champ" />
                  </div>
                  <input name="telephone" type="tel" [(ngModel)]="form.telephone" placeholder="Téléphone * (77 123 45 67)" [class]="champ" />
                  <input name="email" type="email" [(ngModel)]="form.email" placeholder="E-mail" [class]="champ" />
                  <input name="profession" [(ngModel)]="form.profession" placeholder="Profession" [class]="champ" />
                  <label class="text-xs text-slate-400">Date d'entrée souhaitée
                    <input name="date" type="date" [(ngModel)]="form.date_entree_souhaitee" [min]="aujourdhui" [class]="champ + ' mt-1'" />
                  </label>
                  <textarea name="message" rows="3" [(ngModel)]="form.message" placeholder="Votre message (disponibilités pour la visite…)" [class]="champ"></textarea>
                  <!-- Piège à robots -->
                  <input name="site_web" [(ngModel)]="form.site_web" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true" />

                  @if (erreur()) { <p class="text-sm text-neon-rouge">{{ erreur() }}</p> }

                  <button type="submit" [disabled]="envoi()"
                          class="mt-1 rounded-xl bg-neon-rouge py-3.5 font-bold text-white transition hover:glow-rouge disabled:opacity-60">
                    {{ envoi() ? 'Envoi…' : 'Je suis intéressé(e)' }}
                  </button>
                  <p class="text-center text-xs text-slate-500">Gratuit et sans engagement · Réponse sous 48 h</p>
                </form>
              }
            </div>
          </aside>
        </div>
      }
    </main>
  </div>
  `,
})
export class AnnoncePage implements OnInit {
    private service = inject(PortailService);
    private route = inject(ActivatedRoute);

    annonce = signal<Annonce | null>(null);
    chargement = signal(true);
    introuvable = signal(false);
    index = signal(0);

    envoi = signal(false);
    succes = signal<string | null>(null);
    erreur = signal<string | null>(null);

    aujourdhui = new Date().toISOString().slice(0, 10);
    form = { prenom: '', nom: '', telephone: '', email: '', profession: '', date_entree_souhaitee: '', message: '', site_web: '' };

    champ = 'w-full rounded-xl border border-noir-600 bg-noir-950/70 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

    /** URL de la photo affichée en grand */
    photoActive = computed(() => {
        const a = this.annonce();
        if (!a) return null;
        return a.photos[this.index()]?.url ?? a.photo_principale;
    });

    /** Tuiles de caractéristiques : seulement celles qui sont renseignées */
    caracteristiques = computed(() => {
        const a = this.annonce();
        if (!a) return [];
        const liste = [
            { icone: '🛏', libelle: 'Pièces', valeur: a.pieces },
            { icone: '📐', libelle: 'Surface', valeur: a.surface ? `${a.surface} m²` : null },
            { icone: '🚿', libelle: 'Salles de bain', valeur: (a['salles_de_bain'] ?? a['nb_salles_bain'] ?? null) as string | number | null },
            { icone: '🏢', libelle: 'Étage', valeur: (a['etage'] ?? null) as string | number | null },
        ];
        return liste.filter((c) => c.valeur !== null && c.valeur !== undefined && c.valeur !== '');
    });

    ngOnInit(): void {
        const id = Number(this.route.snapshot.paramMap.get('id'));
        this.service.annonce(id).subscribe({
            next: (a) => {
                // La photo principale en premier
                a.photos = [...a.photos].sort((x, y) => Number(y.principale) - Number(x.principale));
                this.annonce.set(a);
                this.chargement.set(false);
            },
            error: () => { this.introuvable.set(true); this.chargement.set(false); },
        });
    }

    defiler(pas: number): void {
        const n = this.annonce()?.photos.length ?? 0;
        if (n) this.index.set((this.index() + pas + n) % n);
    }

    envoyer(id: number): void {
        this.envoi.set(true);
        this.erreur.set(null);
        const f = this.form;
        this.service.demander(id, {
            prenom: f.prenom, nom: f.nom, telephone: f.telephone,
            email: f.email.trim() || null, profession: f.profession.trim() || null,
            date_entree_souhaitee: f.date_entree_souhaitee || null,
            message: f.message.trim() || null, site_web: f.site_web,
        }).subscribe({
            next: (r) => { this.envoi.set(false); this.succes.set(r.message); },
            error: (e: HttpErrorResponse) => {
                this.envoi.set(false);
                const erreurs = e.error?.errors as Record<string, string[]> | undefined;
                this.erreur.set(e.status === 429
                    ? 'Trop d’envois en peu de temps. Réessayez dans une minute.'
                    : erreurs ? Object.values(erreurs)[0]?.[0] : (e.error?.message ?? 'Envoi impossible.'));
            },
        });
    }

    montant(v: number | string): string {
        return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v) || 0) + ' FCFA';
    }
}