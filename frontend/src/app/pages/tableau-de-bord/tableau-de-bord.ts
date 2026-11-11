import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';

interface Gestion {
    kpi: { biens_total: number; biens_loues: number; biens_libres: number; taux_occupation: number; baux_actifs: number; baux_en_preavis: number; demandes_nouvelles: number; signalements_ouverts: number; signalements_urgents: number };
    biens_par_statut: Record<string, number>;
    signalements_par_categorie: Record<string, number>;
    baux_qui_expirent: { id: number; numero: string; bien: string; locataire: string; date_fin: string; jours: number }[];
}
interface Compta {
    kpi: { attendu_mois: number; encaisse_mois: number; taux_recouvrement: number; impayes_total: number; impayes_nb: number; a_valider: number; cautions_a_encaisser: number; cautions_detenues: number; reversements_a_payer: number; commissions_mois: number };
    courbe_12_mois: { mois: string; attendu: number; encaisse: number }[];
    pires_retards: { locataire: string; telephone: string | null; bien: string; mois: string; reste_du: number; jours: number }[];
    derniers_paiements: { locataire: string; montant: number; mode: string; date: string }[];
}
interface Tableau { role: string; gestion?: Gestion; compta?: Compta }

// Couleurs du thème néon
const BLEU = '#00d9ff';
const ROUGE = '#ff2e5b';
const VERT = '#34d399';
const GRIS = '#64748b';

@Component({
    selector: 'app-tableau-de-bord',
    standalone: true,
    imports: [RouterLink],
    template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-7xl">

      <p class="text-sm text-slate-400">{{ salutation() }},</p>
      <h1 class="text-3xl font-extrabold text-white">{{ auth.user()?.prenom }} <span class="text-neon-bleu text-glow-bleu">·</span> Tableau de bord</h1>
      <p class="mt-1 text-sm capitalize text-slate-500">{{ aujourdhui }}</p>

      @if (chargement()) {
        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          @for (n of [1, 2, 3, 4]; track n) { <div class="h-32 animate-pulse rounded-2xl bg-noir-800"></div> }
        </div>
      }

      @if (t(); as d) {

        <!-- =================== COMPTABILITÉ =================== -->
        @if (d.compta; as c) {
          <h2 class="mt-10 text-xs font-bold uppercase tracking-[0.3em] text-neon-bleu">Finances</h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <a routerLink="/comptabilite/paiements" class="group rounded-2xl border border-emerald-400/40 bg-emerald-400/5 p-5 transition hover:-translate-y-1">
              <p class="text-xs uppercase tracking-wider text-emerald-300">Encaissé ce mois</p>
              <p class="mt-2 text-2xl font-extrabold text-white">{{ montant(c.kpi.encaisse_mois) }}</p>
              <p class="text-xs text-slate-500">sur {{ montant(c.kpi.attendu_mois) }} attendus</p>
              <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-noir-600"><div class="h-full rounded-full bg-emerald-400" [style.width.%]="min100(c.kpi.taux_recouvrement)"></div></div>
              <p class="mt-1 text-xs font-semibold text-emerald-300">{{ c.kpi.taux_recouvrement }} % recouvré</p>
            </a>
            <a routerLink="/comptabilite/impayes" class="rounded-2xl border p-5 transition hover:-translate-y-1"
               [class]="c.kpi.impayes_nb > 0 ? 'border-neon-rouge/60 bg-neon-rouge/10 glow-rouge' : 'border-noir-600 bg-noir-800/70'">
              <p class="text-xs uppercase tracking-wider" [class]="c.kpi.impayes_nb > 0 ? 'text-neon-rouge' : 'text-slate-500'">Impayés</p>
              <p class="mt-2 text-2xl font-extrabold text-white">{{ montant(c.kpi.impayes_total) }}</p>
              <p class="text-xs text-slate-500">{{ c.kpi.impayes_nb }} échéance(s) en retard</p>
            </a>
            <a routerLink="/comptabilite/paiements" class="rounded-2xl border p-5 transition hover:-translate-y-1"
               [class]="c.kpi.a_valider > 0 ? 'border-neon-bleu/60 bg-neon-bleu/5 glow-bleu' : 'border-noir-600 bg-noir-800/70'">
              <p class="text-xs uppercase tracking-wider text-neon-bleu">À valider</p>
              <p class="mt-2 text-3xl font-extrabold text-white">{{ c.kpi.a_valider }}</p>
              <p class="text-xs text-slate-500">paiement(s) en attente de vérification</p>
            </a>
            <a routerLink="/comptabilite/reversements" class="rounded-2xl border border-noir-600 bg-noir-800/70 p-5 transition hover:-translate-y-1">
              <p class="text-xs uppercase tracking-wider text-slate-500">Reversements à payer</p>
              <p class="mt-2 text-2xl font-extrabold text-white">{{ montant(c.kpi.reversements_a_payer) }}</p>
              <p class="text-xs text-slate-500">Commissions du mois : {{ montant(c.kpi.commissions_mois) }}</p>
            </a>
          </div>

          <div class="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-5">
              <div class="flex items-center justify-between">
                <h3 class="font-bold text-white">Loyers attendus vs encaissés — 12 mois</h3>
                <span class="text-xs text-slate-500">L'écart = les impayés</span>
              </div>
              <div class="mt-4 h-72"><canvas #courbe></canvas></div>
            </div>

            <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-5">
              <h3 class="font-bold text-white">À relancer en priorité</h3>
              <div class="mt-4 space-y-3">
                @for (r of c.pires_retards; track $index) {
                  <div class="rounded-xl border border-neon-rouge/30 bg-noir-900/60 p-3">
                    <div class="flex items-center justify-between gap-2">
                      <p class="truncate font-semibold text-white">{{ r.locataire }}</p>
                      <span class="shrink-0 text-xs font-bold text-neon-rouge">{{ r.jours }} j</span>
                    </div>
                    <p class="text-xs text-slate-500">{{ r.bien }} · {{ montant(r.reste_du) }}</p>
                    @if (r.telephone) { <a [href]="'tel:' + r.telephone" class="text-xs text-neon-bleu hover:underline">📞 {{ r.telephone }}</a> }
                  </div>
                } @empty {
                  <p class="py-8 text-center text-sm text-emerald-300">✅ Aucun retard</p>
                }
              </div>
            </div>
          </div>
        }

        <!-- =================== GESTION =================== -->
        @if (d.gestion; as g) {
          <h2 class="mt-10 text-xs font-bold uppercase tracking-[0.3em] text-neon-rouge">Patrimoine et activité</h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <a routerLink="/gestion/biens" class="rounded-2xl border border-neon-bleu/50 bg-neon-bleu/5 p-5 glow-bleu transition hover:-translate-y-1">
              <p class="text-xs uppercase tracking-wider text-neon-bleu">Taux d'occupation</p>
              <p class="mt-2 text-4xl font-extrabold text-white">{{ g.kpi.taux_occupation }} %</p>
              <p class="text-xs text-slate-500">{{ g.kpi.biens_loues }} loué(s) · {{ g.kpi.biens_libres }} libre(s)</p>
            </a>
            <a routerLink="/gestion/baux" class="rounded-2xl border border-noir-600 bg-noir-800/70 p-5 transition hover:-translate-y-1">
              <p class="text-xs uppercase tracking-wider text-slate-500">Baux en cours</p>
              <p class="mt-2 text-3xl font-extrabold text-white">{{ g.kpi.baux_actifs }}</p>
              <p class="text-xs text-amber-300">{{ g.kpi.baux_en_preavis }} en préavis</p>
            </a>
            <a routerLink="/gestion/demandes" class="rounded-2xl border p-5 transition hover:-translate-y-1"
               [class]="g.kpi.demandes_nouvelles > 0 ? 'border-neon-rouge/60 bg-neon-rouge/10 glow-rouge' : 'border-noir-600 bg-noir-800/70'">
              <p class="text-xs uppercase tracking-wider text-neon-rouge">Nouvelles demandes</p>
              <p class="mt-2 text-3xl font-extrabold text-white">{{ g.kpi.demandes_nouvelles }}</p>
              <p class="text-xs text-slate-500">à rappeler sous 48 h</p>
            </a>
            <a routerLink="/gestion/maintenance" class="rounded-2xl border p-5 transition hover:-translate-y-1"
               [class]="g.kpi.signalements_urgents > 0 ? 'border-neon-rouge/60 bg-neon-rouge/10 glow-rouge' : 'border-noir-600 bg-noir-800/70'">
              <p class="text-xs uppercase tracking-wider text-slate-500">Pannes ouvertes</p>
              <p class="mt-2 text-3xl font-extrabold text-white">{{ g.kpi.signalements_ouverts }}</p>
              <p class="text-xs" [class]="g.kpi.signalements_urgents > 0 ? 'font-bold text-neon-rouge' : 'text-slate-500'">{{ g.kpi.signalements_urgents }} urgente(s)</p>
            </a>
          </div>

          <div class="mt-4 grid gap-4 lg:grid-cols-3">
            <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-5">
              <h3 class="font-bold text-white">Répartition des biens</h3>
              <div class="mt-4 h-60"><canvas #anneau></canvas></div>
            </div>
            <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-5">
              <h3 class="font-bold text-white">Pannes ouvertes par catégorie</h3>
              <div class="mt-4 h-60"><canvas #barres></canvas></div>
            </div>
            <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-5">
              <h3 class="font-bold text-white">Baux qui expirent (60 j)</h3>
              <div class="mt-4 space-y-3">
                @for (b of g.baux_qui_expirent; track b.id) {
                  <a [routerLink]="['/gestion/baux', b.id]" class="block rounded-xl border border-amber-300/30 bg-noir-900/60 p-3 hover:border-amber-300/70">
                    <div class="flex items-center justify-between gap-2">
                      <p class="truncate font-semibold text-white">{{ b.bien }}</p>
                      <span class="shrink-0 text-xs font-bold text-amber-300">J-{{ b.jours }}</span>
                    </div>
                    <p class="text-xs text-slate-500">{{ b.locataire }} · {{ b.numero }}</p>
                  </a>
                } @empty {
                  <p class="py-8 text-center text-sm text-slate-500">Aucun bail n'expire bientôt.</p>
                }
              </div>
            </div>
          </div>
        }
      }
    </div>
  </div>
  `,
})
export class TableauDeBord implements OnInit, OnDestroy {
    private http = inject(HttpClient);
    auth = inject(AuthService);

    t = signal<Tableau | null>(null);
    chargement = signal(true);

    courbe = viewChild<ElementRef<HTMLCanvasElement>>('courbe');
    anneau = viewChild<ElementRef<HTMLCanvasElement>>('anneau');
    barres = viewChild<ElementRef<HTMLCanvasElement>>('barres');
    private graphiques: Chart[] = [];

    aujourdhui = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    ngOnInit(): void {
        // Style global des graphiques : texte gris clair sur fond noir
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = 'Plus Jakarta Sans, sans-serif';
        Chart.defaults.borderColor = '#1f2937';

        this.http.get<Tableau>(`${environment.apiUrl}/tableau-de-bord`).subscribe({
            next: (d) => {
                this.t.set(d);
                this.chargement.set(false);
                setTimeout(() => this.dessiner(d)); // attendre que les <canvas> soient affichés
            },
            error: () => this.chargement.set(false),
        });
    }

    ngOnDestroy(): void {
        this.graphiques.forEach((g) => g.destroy());
    }

    private dessiner(d: Tableau): void {
        // ---- Courbe attendu / encaissé ----
        const c = this.courbe()?.nativeElement;
        if (c && d.compta) {
            const ctx = c.getContext('2d')!;
            const degrade = ctx.createLinearGradient(0, 0, 0, 280);
            degrade.addColorStop(0, 'rgba(0,217,255,0.35)');
            degrade.addColorStop(1, 'rgba(0,217,255,0)');

            this.graphiques.push(new Chart(c, {
                type: 'line',
                data: {
                    labels: d.compta.courbe_12_mois.map((p) => this.moisCourt(p.mois)),
                    datasets: [
                        { label: 'Encaissé', data: d.compta.courbe_12_mois.map((p) => p.encaisse), borderColor: BLEU, backgroundColor: degrade, fill: true, tension: 0.35, borderWidth: 3, pointRadius: 3, pointBackgroundColor: BLEU },
                        { label: 'Attendu', data: d.compta.courbe_12_mois.map((p) => p.attendu), borderColor: GRIS, borderDash: [6, 6], fill: false, tension: 0.35, borderWidth: 2, pointRadius: 0 },
                    ],
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (x) => `${x.dataset.label} : ${this.montant(Number(x.raw))}` } } },
                    scales: { y: { beginAtZero: true, ticks: { callback: (v) => this.court(Number(v)) } }, x: { grid: { display: false } } },
                },
            }));
        }

        // ---- Anneau : biens par statut ----
        const a = this.anneau()?.nativeElement;
        if (a && d.gestion) {
            const s = d.gestion.biens_par_statut;
            this.graphiques.push(new Chart(a, {
                type: 'doughnut',
                data: {
                    labels: ['Loués', 'Libres', 'Archivés'],
                    datasets: [{ data: [s['loue'] ?? 0, s['libre'] ?? 0, s['archive'] ?? 0], backgroundColor: [ROUGE, VERT, GRIS], borderColor: '#0a0a0f', borderWidth: 4, hoverOffset: 8 }],
                },
                options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom' } } },
            }));
        }

        // ---- Barres : pannes par catégorie ----
        const b = this.barres()?.nativeElement;
        if (b && d.gestion) {
            const p = d.gestion.signalements_par_categorie;
            const libelles: Record<string, string> = { plomberie: 'Plomberie', electricite: 'Électricité', climatisation: 'Clim', serrurerie: 'Serrure', peinture: 'Peinture', menuiserie: 'Menuiserie', autre: 'Autre' };
            this.graphiques.push(new Chart(b, {
                type: 'bar',
                data: {
                    labels: Object.keys(p).map((k) => libelles[k] ?? k),
                    datasets: [{ label: 'Pannes', data: Object.values(p), backgroundColor: 'rgba(255,46,91,0.6)', borderColor: ROUGE, borderWidth: 2, borderRadius: 8 }],
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } },
            }));
        }
    }

    // ----- Affichage -----
    salutation(): string { return new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'; }
    min100(v: number): number { return Math.min(100, v); }
    montant(v: number): string { return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v || 0) + ' FCFA'; }
    court(v: number): string { return v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + ' M' : v >= 1000 ? Math.round(v / 1000) + ' k' : String(v); }
    moisCourt(m: string): string { return new Date(m + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }); }
}