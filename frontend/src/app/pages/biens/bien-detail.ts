import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { BienService } from '../../core/services/bien.service';
import { BienDetail, STATUTS_BIEN, StatutBien, TYPES_BIEN } from '../../core/models/bien.model';
import { BienForm, ResultatBien } from './bien-form';

@Component({
    selector: 'app-bien-detail',
    standalone: true,
    imports: [RouterLink, BienForm],
    template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-7xl">

      <a routerLink="/gestion/biens" class="text-sm text-slate-400 transition hover:text-neon-bleu">← Tous les biens</a>

      @if (chargement()) {
        <div class="mt-6 h-96 animate-pulse rounded-2xl border border-noir-600 bg-noir-800"></div>
      }

      @if (bien(); as b) {
        <!-- ===== En-tête ===== -->
        <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-wider text-slate-500">{{ b.reference }} · {{ libelleType() }}</p>
            <h1 class="mt-1 text-3xl font-extrabold text-white">{{ b.titre }}</h1>
            <div class="mt-3 flex flex-wrap gap-2">
              <span class="rounded-full border px-3 py-1 text-xs font-semibold" [class]="classeStatut(b.statut)">{{ libelleStatut(b.statut) }}</span>
              @if (b.publie) {
                <span class="rounded-full border border-neon-bleu/60 bg-neon-bleu/10 px-3 py-1 text-xs font-semibold text-neon-bleu">● En ligne sur le site</span>
              } @else {
                <span class="rounded-full border border-noir-600 px-3 py-1 text-xs font-semibold text-slate-500">Non publié</span>
              }
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-2">
            <button (click)="formulaireOuvert.set(true)" [class]="bouton + ' border-neon-bleu/60 text-neon-bleu hover:bg-neon-bleu/10'">Modifier</button>

            @if (b.statut === 'libre') {
              <button (click)="basculerPublication()" [disabled]="action()"
                      [class]="bouton + (b.publie ? ' border-slate-500 text-slate-300 hover:bg-noir-700' : ' border-neon-bleu bg-neon-bleu text-noir-950 hover:glow-bleu')">
                {{ b.publie ? 'Retirer du site' : 'Publier sur le site' }}
              </button>
            }

            @if (b.statut !== 'loue') {
              <button (click)="basculerArchivage()" [disabled]="action()"
                      [class]="bouton + ' border-slate-500 text-slate-300 hover:bg-noir-700'">
                {{ b.statut === 'archive' ? 'Réactiver' : 'Archiver' }}
              </button>
            }

            <button (click)="confirmationSuppression.set(true)" [class]="bouton + ' border-neon-rouge/60 text-neon-rouge hover:bg-neon-rouge/10 hover:glow-rouge'">Supprimer</button>
          </div>
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

        <div class="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">

          <!-- ===== Colonne gauche : photos ===== -->
          <section class="space-y-4">

            <!-- Grande photo -->
            <div class="overflow-hidden rounded-2xl border border-noir-600 bg-noir-900">
              @if (photoAffichee(); as p) {
                <img [src]="p.url" [alt]="b.titre" class="h-[26rem] w-full object-cover" />
              } @else {
                <div class="grid h-[26rem] place-items-center text-slate-600">Aucune photo pour ce bien</div>
              }
            </div>

            <!-- Miniatures -->
            @if (b.photos.length) {
              <div class="grid grid-cols-3 gap-3 sm:grid-cols-5">
                @for (p of b.photos; track p.id; let i = $index) {
                  <div class="group relative overflow-hidden rounded-xl border-2 transition"
                       [class]="p.id === photoAffichee()?.id ? 'border-neon-bleu glow-bleu' : 'border-noir-600 hover:border-noir-500'">
                    <button (click)="indexAffiche.set(i)" class="block w-full">
                      <img [src]="p.url" alt="" class="h-20 w-full object-cover" />
                    </button>
                    @if (i === 0) {
                      <span class="absolute left-1 top-1 rounded bg-neon-bleu px-1.5 text-[10px] font-bold text-noir-950">PRINCIPALE</span>
                    }
                    <!-- Actions au survol -->
                    <div class="absolute inset-x-0 bottom-0 flex justify-between bg-noir-950/80 px-1.5 py-1 opacity-0 transition group-hover:opacity-100">
                      @if (i !== 0) {
                        <button (click)="definirPrincipale(p.id)" title="Définir comme principale" class="text-xs text-neon-bleu hover:text-white">★</button>
                      } @else { <span></span> }
                      <button (click)="supprimerPhoto(p.id)" title="Supprimer" class="text-xs text-neon-rouge hover:text-white">✕</button>
                    </div>
                  </div>
                }
              </div>
            }

            <!-- Zone d'envoi -->
            <div (dragover)="$event.preventDefault(); survol.set(true)"
                 (dragleave)="survol.set(false)"
                 (drop)="deposer($event)"
                 (click)="selecteur.click()"
                 class="cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition"
                 [class]="survol() ? 'border-neon-bleu bg-neon-bleu/5 glow-bleu' : 'border-noir-600 hover:border-neon-bleu/50'">
              <input #selecteur type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
                     (change)="choisir($any($event.target).files); selecteur.value = ''" />
              @if (envoi()) {
                <p class="font-semibold text-neon-bleu animate-neon">Envoi des photos en cours…</p>
              } @else {
                <p class="font-semibold text-white">Glissez vos photos ici <span class="text-slate-500">ou cliquez pour choisir</span></p>
                <p class="mt-1 text-xs text-slate-500">JPG, PNG ou WEBP · 4 Mo maximum par photo · 10 par envoi · 15 au total</p>
              }
            </div>
          </section>

          <!-- ===== Colonne droite : informations ===== -->
          <aside class="space-y-4">
            <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-6">
              <p class="text-sm text-slate-400">Loyer mensuel</p>
              <p class="mt-1 text-3xl font-extrabold text-neon-bleu text-glow-bleu">{{ montant(b.loyer_propose) }}</p>

              <dl class="mt-5 space-y-3 text-sm">
                <div class="flex justify-between"><dt class="text-slate-500">Caution</dt><dd class="text-white">{{ montant(b.caution) }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Commission agence</dt><dd class="text-white">{{ +b.taux_commission }} %</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Surface</dt><dd class="text-white">{{ b.surface ? (+b.surface) + ' m²' : '—' }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Pièces</dt><dd class="text-white">{{ b.nb_pieces ?? '—' }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Quartier</dt><dd class="text-white">{{ b.quartier }}</dd></div>
                <div class="flex justify-between gap-4"><dt class="shrink-0 text-slate-500">Adresse</dt><dd class="text-right text-white">{{ b.adresse }}</dd></div>
              </dl>
            </div>

            <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-6">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Propriétaire</p>
              <p class="mt-2 font-semibold text-white">{{ b.proprietaire ? b.proprietaire.prenom + ' ' + b.proprietaire.nom : '—' }}</p>
            </div>

            <div class="rounded-2xl border p-6"
                 [class]="b.bail_actif ? 'border-neon-rouge/50 bg-neon-rouge/5' : 'border-noir-600 bg-noir-800/70'">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Bail en cours</p>
              @if (b.bail_actif; as bail) {
                <p class="mt-2 font-semibold text-white">{{ bail.locataire }}</p>
                <p class="mt-1 text-sm text-slate-400">{{ bail.numero }} · du {{ date(bail.date_debut) }} au {{ date(bail.date_fin) }}</p>
                <p class="mt-1 text-sm text-neon-rouge">{{ montant(bail.loyer_mensuel) }} / mois</p>
              } @else {
                <p class="mt-2 text-sm text-slate-400">Aucun bail : le bien est disponible.</p>
              }
            </div>

            @if (b.description) {
              <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-6">
                <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Description</p>
                <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">{{ b.description }}</p>
              </div>
            }
          </aside>
        </div>

        <!-- Fenêtre de modification -->
        @if (formulaireOuvert()) {
          <app-bien-form [bien]="b" (ferme)="formulaireOuvert.set(false)" (enregistre)="apresModification($event)" />
        }

        <!-- Confirmation de suppression -->
        @if (confirmationSuppression()) {
          <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" (click)="confirmationSuppression.set(false)">
            <div class="w-full max-w-md rounded-2xl border border-neon-rouge/50 bg-noir-800 p-6 glow-rouge" (click)="$event.stopPropagation()">
              <h2 class="text-lg font-bold text-white">Supprimer ce bien ?</h2>
              <p class="mt-2 text-slate-400">« {{ b.titre }} » et toutes ses photos seront supprimés définitivement.</p>
              <div class="mt-6 flex justify-end gap-3">
                <button (click)="confirmationSuppression.set(false)" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 hover:bg-noir-700">Annuler</button>
                <button (click)="supprimer()" [disabled]="action()" class="rounded-xl bg-neon-rouge px-5 py-2.5 font-bold text-white hover:glow-rouge disabled:opacity-60">Supprimer</button>
              </div>
            </div>
          </div>
        }
      }
    </div>
  </div>
  `,
})
export class BienDetailPage implements OnInit {
    private service = inject(BienService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    private id = 0;
    bien = signal<BienDetail | null>(null);
    chargement = signal(true);
    notification = signal<string | null>(null);
    erreur = signal<string | null>(null);
    action = signal(false);
    envoi = signal(false);
    survol = signal(false);
    formulaireOuvert = signal(false);
    confirmationSuppression = signal(false);
    indexAffiche = signal(0);

    bouton = 'rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50';

    photoAffichee = computed(() => {
        const photos = this.bien()?.photos ?? [];
        return photos[this.indexAffiche()] ?? photos[0] ?? null;
    });

    libelleType = computed(() => TYPES_BIEN.find((t) => t.valeur === this.bien()?.type)?.libelle ?? '');

    ngOnInit(): void {
        this.id = Number(this.route.snapshot.paramMap.get('id'));
        // Message transmis après une création (« Bien créé avec succès… »)
        const message = history.state?.message;
        if (message) this.notification.set(message);
        this.charger();
    }

    charger(): void {
        this.service.afficher(this.id).subscribe({
            next: (b) => { this.bien.set(b); this.chargement.set(false); },
            error: () => { this.chargement.set(false); this.router.navigate(['/gestion/biens']); },
        });
    }

    // ----- Actions sur le bien -----

    basculerPublication(): void {
        const b = this.bien();
        if (!b) return;
        this.executer(this.service.publier(b.id, !b.publie));
    }

    basculerArchivage(): void {
        const b = this.bien();
        if (!b) return;
        this.executer(this.service.archiver(b.id, b.statut !== 'archive'));
    }

    apresModification(r: ResultatBien): void {
        this.formulaireOuvert.set(false);
        this.notification.set(r.message);
        this.charger();
    }

    supprimer(): void {
        this.action.set(true);
        this.service.supprimer(this.id).subscribe({
            next: () => this.router.navigate(['/gestion/biens']),
            error: (e: HttpErrorResponse) => {
                this.action.set(false);
                this.confirmationSuppression.set(false);
                this.erreur.set(e.error?.message ?? 'Suppression impossible.');
            },
        });
    }

    // ----- Photos -----

    deposer(evenement: DragEvent): void {
        evenement.preventDefault();
        this.survol.set(false);
        this.choisir(evenement.dataTransfer?.files ?? null);
    }

    choisir(liste: FileList | null): void {
        if (!liste?.length) return;
        const fichiers = Array.from(liste);

        // Vérifications avant l'envoi (Laravel vérifie aussi de son côté)
        const invalide = fichiers.find((f) => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type));
        if (invalide) { this.erreur.set(`« ${invalide.name} » n'est pas une image JPG, PNG ou WEBP.`); return; }
        const tropLourd = fichiers.find((f) => f.size > 4 * 1024 * 1024);
        if (tropLourd) { this.erreur.set(`« ${tropLourd.name} » dépasse 4 Mo.`); return; }
        if (fichiers.length > 10) { this.erreur.set('10 photos maximum par envoi.'); return; }

        this.erreur.set(null);
        this.envoi.set(true);
        this.service.ajouterPhotos(this.id, fichiers).subscribe({
            next: (r) => { this.envoi.set(false); this.notification.set(r.message); this.charger(); },
            error: (e: HttpErrorResponse) => { this.envoi.set(false); this.erreur.set(this.messageErreur(e)); },
        });
    }

    definirPrincipale(photoId: number): void {
        this.service.definirPrincipale(this.id, photoId).subscribe({
            next: (r) => { this.notification.set(r.message); this.indexAffiche.set(0); this.charger(); },
            error: (e: HttpErrorResponse) => this.erreur.set(this.messageErreur(e)),
        });
    }

    supprimerPhoto(photoId: number): void {
        this.service.supprimerPhoto(this.id, photoId).subscribe({
            next: (r) => { this.notification.set(r.message); this.indexAffiche.set(0); this.charger(); },
            error: (e: HttpErrorResponse) => this.erreur.set(this.messageErreur(e)),
        });
    }

    // ----- Utilitaires -----

    private executer(requete: ReturnType<BienService['publier']>): void {
        this.action.set(true);
        this.erreur.set(null);
        requete.subscribe({
            next: (r) => { this.action.set(false); this.notification.set(r.message); this.charger(); },
            error: (e: HttpErrorResponse) => { this.action.set(false); this.erreur.set(this.messageErreur(e)); },
        });
    }

    private messageErreur(e: HttpErrorResponse): string {
        const erreurs = e.error?.errors as Record<string, string[]> | undefined;
        if (erreurs) return Object.values(erreurs)[0]?.[0] ?? 'Données invalides.';
        return e.error?.message ?? 'Une erreur est survenue.';
    }

    montant(valeur: string | number): string {
        return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(valeur)) + ' FCFA';
    }

    date(valeur: string): string {
        return new Date(valeur).toLocaleDateString('fr-FR');
    }

    libelleStatut(statut: StatutBien): string {
        return STATUTS_BIEN[statut];
    }

    classeStatut(statut: StatutBien): string {
        switch (statut) {
            case 'libre': return 'border-emerald-400/60 text-emerald-300';
            case 'loue': return 'border-neon-rouge/60 text-neon-rouge';
            default: return 'border-slate-500/60 text-slate-400';
        }
    }
}