import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface BienP { id: number; reference: string; titre: string; quartier: string | null; statut: string; loyer: number; locataire: string | null; bail: { numero: string; date_fin: string } | null }
interface ReversementP { id: number; numero: string; periode_debut: string; periode_fin: string; montant_brut: string; commission: string; montant_net: string; statut: string; date_paiement: string | null }
interface InterventionP { date: string; bien: string; titre: string; cout: number; a_charge_de: string | null }
interface TableauProprietaire {
  proprietaire: { nom: string; prenom: string } | null;
  resume: { nb_biens: number; nb_loues: number; encaisse_mois: number; impayes_total: number; impayes_nb: number; a_recevoir: number };
  biens: BienP[];
  reversements: ReversementP[];
  interventions: InterventionP[];
}

@Component({
  selector: 'app-espace-proprietaire',
  standalone: true,
  template: `
  <div class="px-4 py-8 md:px-8">
    <div class="mx-auto max-w-6xl">

      @if (chargement()) {
        <div class="h-64 animate-pulse rounded-2xl bg-noir-800"></div>
      } @else if (t(); as d) {

        <p class="text-sm text-slate-400">Bonjour,</p>
        <h1 class="text-3xl font-extrabold text-white">{{ d.proprietaire?.prenom }} {{ d.proprietaire?.nom }}</h1>
        <p class="mt-1 text-slate-400">Voici l'état de votre patrimoine géré par Dalal Immobilier.</p>

        @if (erreur()) { <div class="mt-6 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">{{ erreur() }}</div> }

        <!-- ===== Indicateurs ===== -->
        <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-2xl border border-noir-600 bg-noir-800/70 p-5">
            <p class="text-xs uppercase tracking-wider text-slate-500">Mes biens</p>
            <p class="mt-2 text-3xl font-extrabold text-white">{{ d.resume.nb_biens }}</p>
            <p class="text-xs text-slate-500">{{ d.resume.nb_loues }} loué(s) · taux d'occupation {{ occupation(d) }} %</p>
            <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-noir-600"><div class="h-full rounded-full bg-neon-bleu" [style.width.%]="occupation(d)"></div></div>
          </div>
          <div class="rounded-2xl border border-emerald-400/40 bg-emerald-400/5 p-5">
            <p class="text-xs uppercase tracking-wider text-emerald-300">Encaissé ce mois</p>
            <p class="mt-2 text-2xl font-extrabold text-white">{{ montant(d.resume.encaisse_mois) }}</p>
            <p class="text-xs text-slate-500">loyers validés par l'agence</p>
          </div>
          <div class="rounded-2xl border border-neon-bleu/50 bg-neon-bleu/5 p-5 glow-bleu">
            <p class="text-xs uppercase tracking-wider text-neon-bleu">À recevoir</p>
            <p class="mt-2 text-2xl font-extrabold text-white">{{ montant(d.resume.a_recevoir) }}</p>
            <p class="text-xs text-slate-500">reversements en préparation</p>
          </div>
          <div class="rounded-2xl border p-5" [class]="d.resume.impayes_nb > 0 ? 'border-neon-rouge/60 bg-neon-rouge/10 glow-rouge' : 'border-noir-600 bg-noir-800/70'">
            <p class="text-xs uppercase tracking-wider" [class]="d.resume.impayes_nb > 0 ? 'text-neon-rouge' : 'text-slate-500'">Impayés</p>
            <p class="mt-2 text-2xl font-extrabold text-white">{{ montant(d.resume.impayes_total) }}</p>
            <p class="text-xs text-slate-500">{{ d.resume.impayes_nb }} échéance(s) — l'agence relance</p>
          </div>
        </div>

        <!-- ===== Mes biens ===== -->
        <section class="mt-8">
          <h2 class="text-lg font-bold text-white">Mes biens</h2>
          <div class="mt-4 grid gap-3 md:grid-cols-2">
            @for (b of d.biens; track b.id) {
              <div class="rounded-2xl border bg-noir-800/60 p-5" [class]="b.statut === 'loue' ? 'border-noir-600' : 'border-emerald-400/40'">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-bold text-white">{{ b.titre }}</p>
                    <p class="text-xs text-slate-500"><span class="font-mono">{{ b.reference }}</span> · {{ b.quartier }}</p>
                  </div>
                  <span class="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold" [class]="classeBien(b.statut)">{{ libelleBien(b.statut) }}</span>
                </div>
                <div class="mt-4 flex items-end justify-between border-t border-noir-700 pt-3 text-sm">
                  <div>
                    @if (b.locataire) {
                      <p class="text-slate-300">👤 {{ b.locataire }}</p>
                      <p class="text-xs text-slate-500">Bail {{ b.bail?.numero }} · jusqu'au {{ date(b.bail?.date_fin) }}</p>
                    } @else {
                      <p class="text-emerald-300">En recherche de locataire</p>
                    }
                  </div>
                  <p class="font-bold text-neon-bleu">{{ montant(b.loyer) }}<span class="text-xs font-normal text-slate-500">/mois</span></p>
                </div>
              </div>
            } @empty {
              <p class="text-slate-500">Aucun bien enregistré.</p>
            }
          </div>
        </section>

        <!-- ===== Reversements ===== -->
        <section class="mt-8">
          <h2 class="text-lg font-bold text-white">Mes reversements</h2>
          <div class="mt-4 overflow-x-auto rounded-2xl border border-noir-600 bg-noir-800/60">
            <table class="w-full min-w-[700px] text-left text-sm">
              <thead class="border-b border-noir-600 text-xs uppercase tracking-wider text-slate-400">
                <tr><th class="px-5 py-3">Relevé</th><th class="px-5 py-3">Période</th><th class="px-5 py-3 text-right">Loyers</th><th class="px-5 py-3 text-right">Commission</th><th class="px-5 py-3 text-right">Net</th><th class="px-5 py-3">Statut</th></tr>
              </thead>
              <tbody>
                @for (r of d.reversements; track r.id) {
                  <tr class="border-b border-noir-700">
                    <td class="px-5 py-3"><button (click)="releve(r)" class="font-mono font-semibold text-neon-bleu hover:underline">📄 {{ r.numero }}</button></td>
                    <td class="px-5 py-3 text-slate-400">{{ date(r.periode_debut) }} → {{ date(r.periode_fin) }}</td>
                    <td class="px-5 py-3 text-right text-slate-300">{{ montant(r.montant_brut) }}</td>
                    <td class="px-5 py-3 text-right text-neon-rouge">− {{ montant(r.commission) }}</td>
                    <td class="px-5 py-3 text-right font-bold text-white">{{ montant(r.montant_net) }}</td>
                    <td class="px-5 py-3">
                      @if (r.statut === 'paye') {
                        <span class="rounded-full border border-emerald-400/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">Versé le {{ date(r.date_paiement) }}</span>
                      } @else {
                        <span class="rounded-full border border-amber-300/60 px-2.5 py-0.5 text-xs font-semibold text-amber-300">En préparation</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="px-5 py-8 text-center text-slate-500">Aucun reversement pour l'instant.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <!-- ===== Travaux ===== -->
        @if (d.interventions.length) {
          <section class="mt-8">
            <h2 class="text-lg font-bold text-white">Derniers travaux sur mes biens</h2>
            <div class="mt-4 space-y-2">
              @for (i of d.interventions; track $index) {
                <div class="flex flex-wrap items-center gap-3 rounded-xl border border-noir-600 bg-noir-800/60 px-4 py-3 text-sm">
                  <span class="text-slate-500">{{ date(i.date) }}</span>
                  <span class="flex-1 text-white">{{ i.titre }} <span class="text-slate-500">· {{ i.bien }}</span></span>
                  <span class="font-semibold text-white">{{ montant(i.cout) }}</span>
                  @if (i.a_charge_de) {
                    <span class="rounded-full border px-2.5 py-0.5 text-xs" [class]="i.a_charge_de === 'proprietaire' ? 'border-neon-rouge/60 text-neon-rouge' : 'border-slate-500/60 text-slate-400'">
                      {{ i.a_charge_de === 'proprietaire' ? 'à votre charge' : 'à la charge du ' + i.a_charge_de }}
                    </span>
                  }
                </div>
              }
            </div>
          </section>
        }
      }
    </div>
  </div>
  `,
})
export class EspaceProprietaire implements OnInit {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/mon-espace/proprietaire`;

  t = signal<TableauProprietaire | null>(null);
  chargement = signal(true);
  erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.http.get<TableauProprietaire>(this.api).subscribe({
      next: (d) => { this.t.set(d); this.chargement.set(false); },
      error: () => { this.erreur.set('Chargement impossible.'); this.chargement.set(false); },
    });
  }

  releve(r: ReversementP): void {
    this.http.get(`${this.api}/reversements/${r.id}/releve`, { responseType: 'blob' }).subscribe({
      next: (f) => { const url = URL.createObjectURL(f); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60_000); },
      error: () => this.erreur.set('Relevé indisponible pour le moment.'),
    });
  }

  occupation(d: TableauProprietaire): number {
    return d.resume.nb_biens ? Math.round((d.resume.nb_loues / d.resume.nb_biens) * 100) : 0;
  }
  libelleBien(s: string): string {
    return ({ libre: 'Libre', loue: 'Loué', archive: 'Archivé' } as Record<string, string>)[s] ?? s;
  }
  classeBien(s: string): string {
    return s === 'libre' ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' : s === 'loue' ? 'border-neon-rouge/60 bg-neon-rouge/10 text-neon-rouge' : 'border-slate-500/60 text-slate-400';
  }
  montant(v: number | string): string { return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v) || 0) + ' FCFA'; }
  date(v: string | null | undefined): string { return v ? new Date(v).toLocaleDateString('fr-FR') : '—'; }
}