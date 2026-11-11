import { Component, HostListener, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ProprietaireService } from '../../core/services/proprietaire.service';
import { Proprietaire, ProprietaireSaisie } from '../../core/models/proprietaire.model';

/** Ce que la fenêtre renvoie à la page après un enregistrement réussi. */
export interface ResultatFormulaire {
    message: string;
    motDePasseTemporaire?: string;
}

@Component({
    selector: 'app-proprietaire-form',
    standalone: true,
    imports: [ReactiveFormsModule],
    template: `
  <!-- Fond assombri : un clic dessus ferme la fenêtre -->
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm"
       (click)="fermer()">

    <!-- Fenêtre -->
    <div class="w-full max-w-2xl rounded-2xl border border-noir-600 bg-noir-800 shadow-2xl glow-bleu"
         (click)="$event.stopPropagation()">

      <!-- En-tête -->
      <div class="flex items-center justify-between border-b border-noir-600 px-6 py-4">
        <h2 class="text-lg font-bold text-white">
          {{ proprietaire() ? 'Modifier le propriétaire' : 'Nouveau propriétaire' }}
        </h2>
        <button type="button" (click)="fermer()" aria-label="Fermer"
                class="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 transition hover:text-neon-rouge">
          ×
        </button>
      </div>

      <form [formGroup]="formulaire" (ngSubmit)="enregistrer()" class="px-6 py-5">

        @if (erreurGenerale()) {
          <div class="mb-4 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">
            {{ erreurGenerale() }}
          </div>
        }

        <div class="grid gap-4 md:grid-cols-2">
          <!-- Nom -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="nom">Nom *</label>
            <input id="nom" formControlName="nom" [class]="champ" />
            @if (erreur('nom')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('nom') }}</p> }
          </div>

          <!-- Prénom -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="prenom">Prénom *</label>
            <input id="prenom" formControlName="prenom" [class]="champ" />
            @if (erreur('prenom')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('prenom') }}</p> }
          </div>

          <!-- Email -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="email">Email *</label>
            <input id="email" type="email" formControlName="email" [class]="champ" />
            @if (erreur('email')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('email') }}</p> }
          </div>

          <!-- Téléphone -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="telephone">Téléphone</label>
            <input id="telephone" formControlName="telephone" placeholder="77 000 00 00" [class]="champ" />
            @if (erreur('telephone')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('telephone') }}</p> }
          </div>

          <!-- Adresse -->
          <div class="md:col-span-2">
            <label class="text-sm font-medium text-slate-300" for="adresse">Adresse</label>
            <input id="adresse" formControlName="adresse" placeholder="Ville, pays" [class]="champ" />
            @if (erreur('adresse')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('adresse') }}</p> }
          </div>

          <!-- CNI -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="numero_cni">N° CNI</label>
            <input id="numero_cni" formControlName="numero_cni" [class]="champ" />
            @if (erreur('numero_cni')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('numero_cni') }}</p> }
          </div>

          <!-- RIB -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="rib_reversement">RIB (reversements)</label>
            <input id="rib_reversement" formControlName="rib_reversement" [class]="champ" />
            @if (erreur('rib_reversement')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('rib_reversement') }}</p> }
          </div>
        </div>

        <!-- Boutons -->
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" (click)="fermer()"
                  class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 transition hover:bg-noir-700">
            Annuler
          </button>
          <button type="submit" [disabled]="chargement()"
                  class="rounded-xl bg-neon-bleu px-5 py-2.5 font-bold text-noir-950 transition
                         hover:glow-bleu hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
            {{ chargement() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </form>
    </div>
  </div>
  `,
})
export class ProprietaireForm implements OnInit {
    private fb = inject(FormBuilder);
    private service = inject(ProprietaireService);

    /** null = création ; un propriétaire = modification */
    proprietaire = input<Proprietaire | null>(null);
    ferme = output<void>();
    enregistre = output<ResultatFormulaire>();

    chargement = signal(false);
    erreurGenerale = signal<string | null>(null);
    erreursServeur = signal<Record<string, string[]>>({});

    /** Style commun à tous les champs */
    champ = 'mt-1.5 w-full rounded-xl border border-noir-600 bg-noir-900 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

    formulaire = this.fb.group({
        nom: ['', [Validators.required, Validators.maxLength(100)]],
        prenom: ['', [Validators.required, Validators.maxLength(100)]],
        email: ['', [Validators.required, Validators.email]],
        telephone: [''],
        adresse: [''],
        numero_cni: [''],
        rib_reversement: [''],
    });

    ngOnInit(): void {
        const p = this.proprietaire();
        if (p) {
            this.formulaire.patchValue({
                nom: p.nom,
                prenom: p.prenom,
                email: p.email,
                telephone: p.telephone ?? '',
                adresse: p.adresse ?? '',
                numero_cni: p.numero_cni ?? '',
                rib_reversement: p.rib_reversement ?? '',
            });
        }
    }

    /** Touche Échap = fermer */
    @HostListener('document:keydown.escape')
    fermer(): void {
        if (!this.chargement()) this.ferme.emit();
    }

    /** Message d'erreur d'un champ : d'abord celui de Laravel, sinon celui du formulaire. */
    erreur(nom: string): string | null {
        const serveur = this.erreursServeur()[nom];
        if (serveur?.length) return serveur[0];

        const champ = this.formulaire.get(nom);
        if (!champ || !champ.invalid || !champ.touched) return null;
        if (champ.hasError('required')) return 'Ce champ est obligatoire.';
        if (champ.hasError('email')) return 'Adresse email invalide.';
        if (champ.hasError('maxlength')) return 'Texte trop long.';
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

        const donnees = this.nettoyer();
        const p = this.proprietaire();

        if (p) {
            this.service.modifier(p.id, donnees).subscribe({
                next: (r) => this.enregistre.emit({ message: r.message }),
                error: (e) => this.gererErreur(e),
            });
        } else {
            this.service.creer(donnees).subscribe({
                next: (r) => this.enregistre.emit({ message: r.message, motDePasseTemporaire: r.mot_de_passe_temporaire }),
                error: (e) => this.gererErreur(e),
            });
        }
    }

    /** Champs vides → null (Laravel attend null, pas une chaîne vide). */
    private nettoyer(): ProprietaireSaisie {
        const v = this.formulaire.getRawValue();
        const ouNull = (x: string | null | undefined) => (x && x.trim() ? x.trim() : null);
        return {
            nom: (v.nom ?? '').trim(),
            prenom: (v.prenom ?? '').trim(),
            email: (v.email ?? '').trim(),
            telephone: ouNull(v.telephone),
            adresse: ouNull(v.adresse),
            numero_cni: ouNull(v.numero_cni),
            rib_reversement: ouNull(v.rib_reversement),
        };
    }

    private gererErreur(e: HttpErrorResponse): void {
        this.chargement.set(false);
        if (e.status === 422 && e.error?.errors) {
            this.erreursServeur.set(e.error.errors);
            this.erreurGenerale.set('Certains champs sont à corriger.');
        } else {
            this.erreurGenerale.set(e.error?.message ?? 'Une erreur est survenue. Réessayez.');
        }
    }
}