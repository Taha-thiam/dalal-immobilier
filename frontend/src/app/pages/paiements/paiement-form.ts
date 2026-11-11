import { Component, DestroyRef, HostListener, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { PaiementService } from '../../core/services/paiement.service';
import { EcheanceAEncaisser, MODES_PAIEMENT, ModePaiement } from '../../core/models/paiement.model';

@Component({
    selector: 'app-paiement-form',
    standalone: true,
    imports: [ReactiveFormsModule],
    template: `
  <div class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm" (click)="fermer()">
    <div class="w-full max-w-xl rounded-2xl border border-noir-600 bg-noir-800 shadow-2xl glow-bleu" (click)="$event.stopPropagation()">

      <!-- En-tête -->
      <div class="flex items-center justify-between border-b border-noir-600 px-6 py-4">
        <h2 class="text-lg font-bold text-white">Enregistrer un paiement</h2>
        <button type="button" (click)="fermer()" aria-label="Fermer" class="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 transition hover:text-neon-rouge">×</button>
      </div>

      @let e = echeance();

      <!-- Récapitulatif de l'échéance -->
      <div class="mx-6 mt-5 rounded-xl border border-noir-600 bg-noir-900/70 p-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="font-semibold text-white">{{ e.locataire?.prenom }} {{ e.locataire?.nom }}</p>
            <p class="text-xs text-slate-400">{{ e.bien?.titre }} · {{ e.bail?.numero }}</p>
          </div>
          <p class="rounded-full border border-neon-bleu/50 px-3 py-1 text-xs font-semibold capitalize text-neon-bleu">{{ nomMois(e.mois) }}</p>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div class="rounded-lg bg-noir-800 p-2"><p class="text-slate-500">Dû</p><p class="mt-0.5 font-semibold text-white">{{ montant(e.montant_du) }}</p></div>
          <div class="rounded-lg bg-noir-800 p-2"><p class="text-slate-500">En attente</p><p class="mt-0.5 font-semibold text-amber-300">{{ montant(e.en_attente) }}</p></div>
          <div class="rounded-lg bg-noir-800 p-2"><p class="text-slate-500">À encaisser</p><p class="mt-0.5 font-bold text-neon-bleu">{{ montant(disponible()) }}</p></div>
        </div>
      </div>

      <form [formGroup]="formulaire" (ngSubmit)="enregistrer()" class="px-6 py-5">

        @if (erreurGenerale()) {
          <div class="mb-4 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">{{ erreurGenerale() }}</div>
        }

        @if (disponible() <= 0) {
          <div class="rounded-xl border border-amber-300/50 bg-amber-300/10 px-4 py-3 text-sm text-amber-300">
            Des paiements couvrent déjà tout le reste dû : validez-les dans l'onglet « À valider ».
          </div>
        } @else {
          <!-- Mode de paiement -->
          <label class="text-sm font-medium text-slate-300">Mode de paiement *</label>
          <div class="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            @for (m of modes; track m.valeur) {
              <button type="button" (click)="formulaire.controls.mode_paiement.setValue(m.valeur)"
                      class="rounded-xl border px-3 py-2.5 text-sm font-semibold transition"
                      [class]="formulaire.controls.mode_paiement.value === m.valeur
                        ? 'border-neon-bleu bg-neon-bleu/10 text-neon-bleu glow-bleu'
                        : 'border-noir-600 text-slate-300 hover:border-neon-bleu/50'">
                {{ m.libelle }}
              </button>
            }
          </div>

          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <!-- Montant -->
            <div>
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium text-slate-300" for="montant">Montant (FCFA) *</label>
                <button type="button" (click)="formulaire.controls.montant.setValue(disponible())" class="text-xs font-semibold text-neon-bleu hover:underline">Tout</button>
              </div>
              <input id="montant" type="number" min="1" step="500" formControlName="montant" [class]="champ" />
              @if (erreur('montant')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('montant') }}</p> }
            </div>

            <!-- Date -->
            <div>
              <label class="text-sm font-medium text-slate-300" for="date">Date du paiement *</label>
              <input id="date" type="date" [max]="aujourdhui" formControlName="date_paiement" [class]="champ" />
              @if (erreur('date_paiement')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('date_paiement') }}</p> }
            </div>

            <!-- Référence -->
            <div class="sm:col-span-2">
              <label class="text-sm font-medium text-slate-300" for="reference">
                Référence de transaction {{ referenceObligatoire() ? '*' : '(facultative)' }}
              </label>
              <input id="reference" formControlName="reference"
                     [placeholder]="referenceObligatoire() ? 'Ex. : WV-2026-118734' : 'N° de reçu manuscrit, si disponible'"
                     [class]="champ" />
              @if (erreur('reference')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('reference') }}</p> }
            </div>
          </div>

          @if (paiementPartiel()) {
            <p class="mt-4 rounded-lg bg-amber-300/10 px-3 py-2 text-xs text-amber-300">
              Paiement partiel : il restera {{ montant(disponible() - (formulaire.controls.montant.value ?? 0)) }} à encaisser pour ce mois. Aucune quittance ne sera émise avant le solde.
            </p>
          }
        }

        <!-- Boutons -->
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" (click)="fermer()" class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 transition hover:bg-noir-700">Annuler</button>
          @if (disponible() > 0) {
            <button type="submit" [disabled]="chargement()"
                    class="rounded-xl bg-neon-bleu px-5 py-2.5 font-bold text-noir-950 transition hover:glow-bleu hover:brightness-110 disabled:opacity-60">
              {{ chargement() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
          }
        </div>
      </form>
    </div>
  </div>
  `,
})
export class PaiementForm implements OnInit {
    private fb = inject(FormBuilder);
    private service = inject(PaiementService);
    private destroyRef = inject(DestroyRef);

    echeance = input.required<EcheanceAEncaisser>();
    ferme = output<void>();
    enregistre = output<string>();

    modes = MODES_PAIEMENT;
    aujourdhui = new Date().toISOString().slice(0, 10);
    chargement = signal(false);
    erreurGenerale = signal<string | null>(null);
    erreursServeur = signal<Record<string, string[]>>({});
    private montantSaisi = signal(0);
    private mode = signal<ModePaiement>('especes');

    champ = 'mt-1.5 w-full rounded-xl border border-noir-600 bg-noir-900 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

    /** Ce qui peut encore être encaissé : reste dû moins les paiements en attente */
    disponible = computed(() => Math.max(0, Number(this.echeance().reste_du) - Number(this.echeance().en_attente)));

    paiementPartiel = computed(() => this.montantSaisi() > 0 && this.montantSaisi() < this.disponible());

    /** Pour Wave, Orange Money et virement, la référence permet de rapprocher le paiement du relevé */
    referenceObligatoire = computed(() => this.mode() !== 'especes');

    formulaire = this.fb.group({
        montant: [0, [Validators.required, Validators.min(1)]],
        date_paiement: [this.aujourdhui, Validators.required],
        mode_paiement: ['especes' as ModePaiement, Validators.required],
        reference: [''],
    });

    ngOnInit(): void {
        this.formulaire.controls.montant.setValue(this.disponible());
        this.formulaire.controls.montant.addValidators(Validators.max(this.disponible()));
        this.montantSaisi.set(this.disponible());

        this.formulaire.controls.montant.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((v) => this.montantSaisi.set(Number(v) || 0));

        // La référence devient obligatoire hors espèces
        this.formulaire.controls.mode_paiement.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((m) => {
                this.mode.set(m ?? 'especes');
                const ref = this.formulaire.controls.reference;
                ref.setValidators(m && m !== 'especes' ? [Validators.required] : []);
                ref.updateValueAndValidity();
            });
    }

    @HostListener('document:keydown.escape')
    fermer(): void {
        if (!this.chargement()) this.ferme.emit();
    }

    erreur(nom: string): string | null {
        const serveur = this.erreursServeur()[nom];
        if (serveur?.length) return serveur[0];

        const champ = this.formulaire.get(nom);
        if (!champ || !champ.invalid || !champ.touched) return null;
        if (champ.hasError('required')) return nom === 'reference' ? 'Indiquez la référence de la transaction.' : 'Ce champ est obligatoire.';
        if (champ.hasError('min')) return 'Le montant doit être positif.';
        if (champ.hasError('max')) return 'Le montant dépasse ce qui reste à encaisser.';
        return 'Valeur invalide.';
    }

    enregistrer(): void {
        if (this.formulaire.invalid) {
            this.formulaire.markAllAsTouched();
            return;
        }

        this.chargement.set(true);
        this.erreurGenerale.set(null);
        this.erreursServeur.set({});
        const v = this.formulaire.getRawValue();

        this.service.enregistrer({
            echeance_id: this.echeance().id,
            montant: Number(v.montant),
            date_paiement: v.date_paiement!,
            mode_paiement: v.mode_paiement!,
            reference: v.reference?.trim() || null,
        }).subscribe({
            next: (r) => this.enregistre.emit(r.message),
            error: (e: HttpErrorResponse) => {
                this.chargement.set(false);
                if (e.status === 422 && e.error?.errors) {
                    this.erreursServeur.set(e.error.errors);
                    this.erreurGenerale.set(Object.values(e.error.errors as Record<string, string[]>)[0]?.[0] ?? 'Données invalides.');
                } else {
                    this.erreurGenerale.set(e.error?.message ?? 'Une erreur est survenue.');
                }
            },
        });
    }

    nomMois(v: string): string {
        return new Date(v + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }

    montant(v: string | number): string {
        return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v) || 0) + ' FCFA';
    }
}