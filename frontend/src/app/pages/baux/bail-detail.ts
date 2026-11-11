import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FinBailPanneau } from './fin-bail-panneau';
import { BailService } from '../../core/services/bail.service';
import { BailDetail, Echeance, STATUTS_BAIL, STATUTS_ECHEANCE, StatutBail } from '../../core/models/bail.model';

@Component({
  selector: 'app-bail-detail',
  standalone: true,
  imports: [RouterLink, LowerCasePipe, FinBailPanneau],
  template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-7xl">

      <a routerLink="/gestion/baux" class="text-sm text-slate-400 transition hover:text-neon-bleu">← Tous les baux</a>

      @if (chargement()) {
        <div class="mt-6 h-96 animate-pulse rounded-2xl border border-noir-600 bg-noir-800"></div>
      }

      @if (bail(); as b) {
        <!-- ===== En-tête ===== -->
        <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="font-mono text-sm font-semibold text-neon-bleu text-glow-bleu">{{ b.numero }}</p>
            <h1 class="mt-1 text-3xl font-extrabold text-white">{{ b.bien?.titre }}</h1>
            <p class="mt-1 text-slate-400">
              Loué à <span class="font-semibold text-white">{{ b.locataire?.prenom }} {{ b.locataire?.nom }}</span>
              · Propriétaire : {{ b.proprietaire?.prenom }} {{ b.proprietaire?.nom }}
            </p>
            <span class="mt-3 inline-block rounded-full border px-3 py-1 text-xs font-semibold" [class]="classeStatut(b.statut)">
              Bail {{ libelleStatut(b.statut) | lowercase }}
            </span>
          </div>

          <!-- Contrat -->
          <div class="flex flex-wrap gap-2">
            <button (click)="voirContrat()" [disabled]="pdfEnCours()"
                    class="rounded-xl bg-neon-bleu px-4 py-2 text-sm font-bold text-noir-950 transition hover:glow-bleu disabled:opacity-50">
              {{ pdfEnCours() ? 'Chargement…' : 'Voir le contrat PDF' }}
            </button>
            <button (click)="telechargerContrat()" [disabled]="pdfEnCours()"
                    class="rounded-xl border border-neon-bleu/60 px-4 py-2 text-sm font-semibold text-neon-bleu transition hover:bg-neon-bleu/10 disabled:opacity-50">
              Télécharger
            </button>
            <button (click)="regenerer()" [disabled]="pdfEnCours()"
                    class="rounded-xl border border-noir-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-noir-700 disabled:opacity-50">
              Régénérer
            </button>
          </div>
        </div>

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

        <!-- ===== Chiffres clés ===== -->
        <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-5">
            <p class="text-xs uppercase tracking-wider text-slate-500">Loyer mensuel</p>
            <p class="mt-2 text-2xl font-extrabold text-neon-bleu">{{ montant(+b.loyer_mensuel + +b.charges) }}</p>
            @if (+b.charges > 0) { <p class="text-xs text-slate-500">dont {{ montant(b.charges) }} de charges</p> }
          </div>
          <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-5">
            <p class="text-xs uppercase tracking-wider text-slate-500">Déjà payé</p>
            <p class="mt-2 text-2xl font-extrabold text-emerald-300">{{ montant(totaux().paye) }}</p>
            <p class="text-xs text-slate-500">{{ totaux().payees }} échéance(s) soldée(s)</p>
          </div>
          <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-5">
            <p class="text-xs uppercase tracking-wider text-slate-500">Reste à percevoir</p>
            <p class="mt-2 text-2xl font-extrabold text-white">{{ montant(totaux().reste) }}</p>
            <p class="text-xs text-slate-500">sur {{ b.echeances.length }} mois</p>
          </div>
          <div class="rounded-2xl border p-5"
               [class]="totaux().enRetard > 0 ? 'border-neon-rouge/60 bg-neon-rouge/10 glow-rouge' : 'border-noir-600 bg-noir-800/70'">
            <p class="text-xs uppercase tracking-wider text-slate-500">En retard</p>
            <p class="mt-2 text-2xl font-extrabold" [class]="totaux().enRetard > 0 ? 'text-neon-rouge text-glow-rouge' : 'text-slate-300'">
              {{ totaux().enRetard }}
            </p>
            <p class="text-xs text-slate-500">échéance(s) dépassée(s)</p>
          </div>
        </div>

        <!-- ===== Fin de bail (NOUVEAU) ===== -->
        <div class="mt-6">
          <app-fin-bail-panneau [bail]="$any(b)" (modifie)="charger()" />
        </div>

        <div class="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">

          <!-- ===== Échéancier ===== -->
          <section class="rounded-2xl border border-noir-600 bg-noir-800/70 p-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-lg font-bold text-white">Échéancier</h2>
              <div class="flex flex-wrap gap-3 text-xs text-slate-400">
                <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>Payée</span>
                <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-amber-300"></span>Partielle</span>
                <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-neon-rouge"></span>En retard</span>
                <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-slate-500"></span>À venir</span>
              </div>
            </div>

            <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              @for (e of b.echeances; track e.id) {
                <div class="rounded-xl border p-3 transition hover:-translate-y-0.5" [class]="classeEcheance(e)">
                  <p class="text-sm font-bold capitalize text-white">{{ nomMois(e.mois) }}</p>
                  <p class="mt-1 text-xs text-slate-400">avant le {{ date(e.date_limite) }}</p>
                  <p class="mt-2 text-sm font-semibold text-slate-200">{{ montant(e.montant_du) }}</p>
                  @if (e.statut === 'partielle') {
                    <p class="text-xs text-amber-300">reste {{ montant(e.reste_du) }}</p>
                  }
                  <p class="mt-1 text-[11px] font-semibold uppercase tracking-wider" [class]="couleurTexte(e)">{{ libelleEcheance(e) }}</p>
                </div>
              }
            </div>
          </section>

          <!-- ===== Colonne droite ===== -->
          <aside class="space-y-4">
            <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-6">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Durée</p>
              <p class="mt-2 text-white">{{ date(b.date_debut) }} → {{ date(b.date_fin) }}</p>
              <div class="mt-3 h-2 overflow-hidden rounded-full bg-noir-600">
                <div class="h-full rounded-full bg-neon-bleu" [style.width.%]="progression()"></div>
              </div>
              <p class="mt-1 text-xs text-slate-500">{{ progression() }} % écoulé</p>
              <dl class="mt-4 space-y-2 text-sm">
                <div class="flex justify-between"><dt class="text-slate-500">Type</dt><dd class="capitalize text-white">{{ b.type_bail }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Paiement</dt><dd class="text-white">le {{ b.jour_echeance }} du mois</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Préavis</dt><dd class="text-white">{{ b.preavis_mois }} mois</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Reconduction</dt><dd class="text-white">{{ b.renouvellement_tacite ? 'Tacite' : 'Non' }}</dd></div>
              </dl>
            </div>

            <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-6">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Caution et avance</p>
              <div class="mt-3 flex items-center justify-between">
                <span class="text-white">{{ montant(b.caution?.montant ?? 0) }}</span>
                <span class="rounded-full border px-2.5 py-0.5 text-xs font-semibold" [class]="classeCaution(b.caution?.statut)">
                  {{ libelleCaution(b.caution?.statut) }}
                </span>
              </div>
              <p class="mt-2 text-sm text-slate-400">Avance : {{ montant(b.avance) }}</p>
            </div>

            <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-6">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Le bien</p>
              <a [routerLink]="['/gestion/biens', b.bien?.id]" class="mt-2 block font-semibold text-neon-bleu hover:underline">
                {{ b.bien?.reference }} — {{ b.bien?.titre }}
              </a>
              <p class="text-sm text-slate-400">{{ b.bien?.quartier }}</p>
            </div>

            <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-6">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Contrats générés</p>
              @for (c of b.contrats; track c.id) {
                <p class="mt-2 text-sm text-slate-300">Version {{ c.version }} <span class="text-slate-500">· {{ c.date_ajout ? date(c.date_ajout) : '' }}</span></p>
              } @empty {
                <p class="mt-2 text-sm text-neon-rouge">Aucun contrat : cliquez sur « Régénérer ».</p>
              }
              @if (b.gestionnaire) { <p class="mt-3 text-xs text-slate-500">Bail créé par {{ b.gestionnaire }}</p> }
            </div>

            @if (b.clauses) {
              <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-6">
                <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Clauses particulières</p>
                <p class="mt-2 whitespace-pre-line text-sm text-slate-300">{{ b.clauses }}</p>
              </div>
            }
          </aside>
        </div>
      }
    </div>
  </div>
  `,
})
export class BailDetailPage implements OnInit {
  private service = inject(BailService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private id = 0;
  bail = signal<BailDetail | null>(null);
  chargement = signal(true);
  pdfEnCours = signal(false);
  notification = signal<string | null>(null);
  erreur = signal<string | null>(null);

  totaux = computed(() => {
    const echeances = this.bail()?.echeances ?? [];
    return {
      paye: echeances.reduce((s, e) => s + (Number(e.montant_du) - Number(e.reste_du)), 0),
      reste: echeances.reduce((s, e) => s + Number(e.reste_du), 0),
      payees: echeances.filter((e) => e.statut === 'payee').length,
      enRetard: echeances.filter((e) => this.enRetard(e)).length,
    };
  });

  progression = computed(() => {
    const b = this.bail();
    if (!b) return 0;
    const debut = new Date(b.date_debut).getTime();
    const fin = new Date(b.date_fin).getTime();
    return Math.max(0, Math.min(100, Math.round(((Date.now() - debut) / (fin - debut)) * 100)));
  });

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    const message = history.state?.message;
    if (message) this.notification.set(message);
    this.charger();
  }

  charger(): void {
    this.service.afficher(this.id).subscribe({
      next: (b) => { this.bail.set(b); this.chargement.set(false); },
      error: () => { this.chargement.set(false); this.router.navigate(['/gestion/baux']); },
    });
  }

  // ----- Contrat PDF -----

  /** Ouvre le PDF dans un nouvel onglet */
  voirContrat(): void {
    this.recupererPdf((url) => window.open(url, '_blank'));
  }

  /** Télécharge le PDF sur l'ordinateur */
  telechargerContrat(): void {
    this.recupererPdf((url) => {
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = `Contrat-${this.bail()?.numero}.pdf`;
      lien.click();
    });
  }

  regenerer(): void {
    this.pdfEnCours.set(true);
    this.service.regenererContrat(this.id).subscribe({
      next: (r) => { this.pdfEnCours.set(false); this.notification.set(r.message); this.charger(); },
      error: (e: HttpErrorResponse) => { this.pdfEnCours.set(false); this.erreur.set(e.error?.message ?? 'Échec de la génération.'); },
    });
  }

  private recupererPdf(action: (url: string) => void): void {
    this.pdfEnCours.set(true);
    this.erreur.set(null);
    this.service.telechargerContrat(this.id).subscribe({
      next: (fichier) => {
        this.pdfEnCours.set(false);
        const url = URL.createObjectURL(fichier);
        action(url);
        setTimeout(() => URL.revokeObjectURL(url), 60_000); // libère la mémoire après 1 minute
      },
      error: () => {
        this.pdfEnCours.set(false);
        this.erreur.set('Contrat introuvable. Cliquez sur « Régénérer » pour le recréer.');
      },
    });
  }

  // ----- Échéances -----

  enRetard(e: Echeance): boolean {
    return e.statut !== 'payee' && new Date(e.date_limite + 'T23:59:59').getTime() < Date.now();
  }

  libelleEcheance(e: Echeance): string {
    if (this.enRetard(e)) return 'En retard';
    if (e.statut === 'impayee') return 'À venir';
    return STATUTS_ECHEANCE[e.statut];
  }

  classeEcheance(e: Echeance): string {
    if (e.statut === 'payee') return 'border-emerald-400/50 bg-emerald-400/5';
    if (this.enRetard(e)) return 'border-neon-rouge/60 bg-neon-rouge/10 glow-rouge';
    if (e.statut === 'partielle') return 'border-amber-300/50 bg-amber-300/5';
    return 'border-noir-600 bg-noir-900/60';
  }

  couleurTexte(e: Echeance): string {
    if (e.statut === 'payee') return 'text-emerald-300';
    if (this.enRetard(e)) return 'text-neon-rouge';
    if (e.statut === 'partielle') return 'text-amber-300';
    return 'text-slate-500';
  }

  // ----- Affichage -----

  nomMois(v: string): string {
    return new Date(v + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  montant(v: string | number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v) || 0) + ' FCFA';
  }

  date(v: string): string {
    return new Date(v).toLocaleDateString('fr-FR');
  }

  /** Gère aussi les nouveaux statuts de fin de bail. */
  libelleStatut(s: StatutBail | string): string {
    const nouveaux: Record<string, string> = {
      en_preavis: 'En préavis', termine: 'Terminé', resilie: 'Résilié', renouvele: 'Renouvelé',
    };
    return (STATUTS_BAIL as Record<string, string>)[s] ?? nouveaux[s] ?? s;
  }

  classeStatut(s: StatutBail | string): string {
    switch (s) {
      case 'actif': return 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300';
      case 'en_preavis': return 'border-amber-300/60 bg-amber-300/10 text-amber-300';
      case 'resilie': return 'border-neon-rouge/60 bg-neon-rouge/10 text-neon-rouge';
      default: return 'border-slate-500/60 text-slate-400';
    }
  }

  libelleCaution(s?: string): string {
    switch (s) {
      case 'encaissee': return 'Encaissée';
      case 'restituee': return 'Restituée';
      default: return 'À encaisser';
    }
  }

  classeCaution(s?: string): string {
    switch (s) {
      case 'encaissee': return 'border-neon-bleu/60 text-neon-bleu';
      case 'restituee': return 'border-emerald-400/60 text-emerald-300';
      default: return 'border-amber-300/60 text-amber-300';
    }
  }
}