import { Component, DestroyRef, HostListener, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { BienService } from '../../core/services/bien.service';
import { ProprietaireService } from '../../core/services/proprietaire.service';
import { Bien, BienSaisie, TYPES_BIEN, TypeBien } from '../../core/models/bien.model';
import { Proprietaire } from '../../core/models/proprietaire.model';

export interface ResultatBien {
    message: string;
    bienId: number;
    creation: boolean;
}

@Component({
    selector: 'app-bien-form',
    standalone: true,
    imports: [ReactiveFormsModule],
    template: `
  <div class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm" (click)="fermer()">
    <div class="w-full max-w-3xl rounded-2xl border border-noir-600 bg-noir-800 shadow-2xl glow-bleu" (click)="$event.stopPropagation()">

      <!-- En-tête -->
      <div class="flex items-center justify-between border-b border-noir-600 px-6 py-4">
        <h2 class="text-lg font-bold text-white">{{ bien() ? 'Modifier le bien' : 'Nouveau bien' }}</h2>
        <button type="button" (click)="fermer()" aria-label="Fermer"
                class="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 transition hover:text-neon-rouge">×</button>
      </div>

      <form [formGroup]="formulaire" (ngSubmit)="enregistrer()" class="px-6 py-5">

        @if (erreurGenerale()) {
          <div class="mb-4 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">{{ erreurGenerale() }}</div>
        }

        <!-- ===== Propriétaire (recherche) ===== -->
        <div class="relative">
          <label class="text-sm font-medium text-slate-300" for="proprio">Propriétaire *</label>
          @if (proprietaireChoisi(); as p) {
            <div class="mt-1.5 flex items-center justify-between rounded-xl border border-neon-bleu/50 bg-neon-bleu/10 px-4 py-2.5">
              <span class="font-semibold text-neon-bleu">{{ p.prenom }} {{ p.nom }}</span>
              <button type="button" (click)="changerProprietaire()" class="text-sm text-slate-400 hover:text-white">Changer</button>
            </div>
          } @else {
            <input id="proprio" type="search" autocomplete="off" placeholder="Tapez un nom pour rechercher…"
                   (input)="rechercherProprietaire($any($event.target).value)" [class]="champ" />
            @if (suggestions().length) {
              <ul class="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-noir-600 bg-noir-900 shadow-2xl">
                @for (s of suggestions(); track s.id) {
                  <li>
                    <button type="button" (click)="choisirProprietaire(s)"
                            class="w-full px-4 py-2.5 text-left text-sm text-slate-200 transition hover:bg-neon-bleu/10 hover:text-neon-bleu">
                      {{ s.prenom }} {{ s.nom }} <span class="text-slate-500">— {{ s.email }}</span>
                    </button>
                  </li>
                }
              </ul>
            }
          }
          @if (erreur('proprietaire_id')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('proprietaire_id') }}</p> }
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <!-- Type -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="type">Type *</label>
            <select id="type" formControlName="type" [class]="champ">
              @for (t of types; track t.valeur) { <option [value]="t.valeur">{{ t.libelle }}</option> }
            </select>
          </div>

          <!-- Titre -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="titre">Titre de l'annonce *</label>
            <input id="titre" formControlName="titre" placeholder="F3 lumineux avec vue mer" [class]="champ" />
            @if (erreur('titre')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('titre') }}</p> }
          </div>

          <!-- Quartier -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="quartier">Quartier *</label>
            <input id="quartier" formControlName="quartier" list="quartiers" placeholder="Almadies" [class]="champ" />
            <datalist id="quartiers">
              @for (q of quartiers; track q) { <option [value]="q"></option> }
            </datalist>
            @if (erreur('quartier')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('quartier') }}</p> }
          </div>

          <!-- Adresse -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="adresse">Adresse *</label>
            <input id="adresse" formControlName="adresse" placeholder="Route des Almadies, Dakar" [class]="champ" />
            @if (erreur('adresse')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('adresse') }}</p> }
          </div>

          <!-- Surface -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="surface">Surface (m²)</label>
            <input id="surface" type="number" min="0" formControlName="surface" [class]="champ" />
            @if (erreur('surface')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('surface') }}</p> }
          </div>

          <!-- Pièces -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="nb_pieces">Nombre de pièces</label>
            <input id="nb_pieces" type="number" min="0" formControlName="nb_pieces" [class]="champ" />
            @if (erreur('nb_pieces')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('nb_pieces') }}</p> }
          </div>

          <!-- Loyer -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="loyer">Loyer mensuel (FCFA) *</label>
            <input id="loyer" type="number" min="0" step="1000" formControlName="loyer_propose" [class]="champ" />
            @if (erreur('loyer_propose')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('loyer_propose') }}</p> }
          </div>

          <!-- Caution -->
          <div>
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-slate-300" for="caution">Caution (FCFA)</label>
              <button type="button" (click)="cautionDeuxMois()" class="text-xs font-semibold text-neon-bleu hover:underline">= 2 mois de loyer</button>
            </div>
            <input id="caution" type="number" min="0" step="1000" formControlName="caution" [class]="champ" />
            @if (erreur('caution')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('caution') }}</p> }
          </div>

          <!-- Commission -->
          <div>
            <label class="text-sm font-medium text-slate-300" for="commission">Commission de l'agence (%)</label>
            <input id="commission" type="number" min="0" max="100" step="0.5" formControlName="taux_commission"
                   placeholder="10 (par défaut)" [class]="champ" />
            @if (erreur('taux_commission')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('taux_commission') }}</p> }
          </div>

          <!-- Description -->
          <div class="md:col-span-2">
            <label class="text-sm font-medium text-slate-300" for="description">Description</label>
            <textarea id="description" rows="4" formControlName="description"
                      placeholder="Étage, équipements, points forts du quartier…" [class]="champ"></textarea>
            @if (erreur('description')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('description') }}</p> }
          </div>
        </div>

        <!-- Boutons -->
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" (click)="fermer()"
                  class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 transition hover:bg-noir-700">Annuler</button>
          <button type="submit" [disabled]="chargement()"
                  class="rounded-xl bg-neon-bleu px-5 py-2.5 font-bold text-noir-950 transition hover:glow-bleu hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
            {{ chargement() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </form>
    </div>
  </div>
  `,
})
export class BienForm implements OnInit {
    private fb = inject(FormBuilder);
    private service = inject(BienService);
    private proprietaires = inject(ProprietaireService);
    private destroyRef = inject(DestroyRef);

    /** null = création ; un bien = modification */
    bien = input<Bien | null>(null);
    ferme = output<void>();
    enregistre = output<ResultatBien>();

    types = TYPES_BIEN;
    quartiers = ['Almadies', 'Ngor', 'Ouakam', 'Mermoz', 'Sacré-Cœur', 'Point E', 'Fann', 'Plateau', 'Médina',
        'Liberté 6', 'Ouest Foire', 'Yoff', 'Grand Yoff', 'HLM', 'Parcelles Assainies', 'Keur Massar', 'Rufisque', 'Saly'];

    chargement = signal(false);
    erreurGenerale = signal<string | null>(null);
    erreursServeur = signal<Record<string, string[]>>({});

    proprietaireChoisi = signal<{ id: number; nom: string; prenom: string } | null>(null);
    suggestions = signal<Proprietaire[]>([]);
    private recherche$ = new Subject<string>();

    champ = 'mt-1.5 w-full rounded-xl border border-noir-600 bg-noir-900 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

    formulaire = this.fb.group({
        proprietaire_id: [null as number | null, Validators.required],
        type: ['appartement' as TypeBien, Validators.required],
        titre: ['', [Validators.required, Validators.maxLength(150)]],
        quartier: ['', [Validators.required, Validators.maxLength(100)]],
        adresse: ['', [Validators.required, Validators.maxLength(255)]],
        surface: [null as number | null, Validators.min(0)],
        nb_pieces: [null as number | null, Validators.min(0)],
        loyer_propose: [null as number | null, [Validators.required, Validators.min(0)]],
        caution: [null as number | null, Validators.min(0)],
        taux_commission: [null as number | null, [Validators.min(0), Validators.max(100)]],
        description: [''],
    });

    ngOnInit(): void {
        // Recherche de propriétaires 300 ms après la dernière frappe
        this.recherche$
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                switchMap((texte) => this.proprietaires.lister(1, texte)),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe((page) => this.suggestions.set(page.data));

        const b = this.bien();
        if (b) {
            this.proprietaireChoisi.set(b.proprietaire);
            this.formulaire.patchValue({
                proprietaire_id: b.proprietaire?.id ?? null,
                type: b.type,
                titre: b.titre,
                quartier: b.quartier,
                adresse: b.adresse,
                surface: b.surface !== null ? Number(b.surface) : null,
                nb_pieces: b.nb_pieces,
                loyer_propose: Number(b.loyer_propose),
                caution: Number(b.caution),
                taux_commission: Number(b.taux_commission),
                description: b.description ?? '',
            });
        }
    }

    @HostListener('document:keydown.escape')
    fermer(): void {
        if (!this.chargement()) this.ferme.emit();
    }

    rechercherProprietaire(texte: string): void {
        if (texte.trim().length < 2) {
            this.suggestions.set([]);
            return;
        }
        this.recherche$.next(texte);
    }

    choisirProprietaire(p: Proprietaire): void {
        this.proprietaireChoisi.set({ id: p.id, nom: p.nom, prenom: p.prenom });
        this.formulaire.controls.proprietaire_id.setValue(p.id);
        this.suggestions.set([]);
    }

    changerProprietaire(): void {
        this.proprietaireChoisi.set(null);
        this.formulaire.controls.proprietaire_id.setValue(null);
    }

    cautionDeuxMois(): void {
        const loyer = this.formulaire.controls.loyer_propose.value;
        if (loyer) this.formulaire.controls.caution.setValue(loyer * 2);
    }

    erreur(nom: string): string | null {
        const serveur = this.erreursServeur()[nom];
        if (serveur?.length) return serveur[0];

        const champ = this.formulaire.get(nom);
        if (!champ || !champ.invalid || !champ.touched) return null;
        if (champ.hasError('required')) return nom === 'proprietaire_id' ? 'Choisissez un propriétaire.' : 'Ce champ est obligatoire.';
        if (champ.hasError('min')) return 'La valeur ne peut pas être négative.';
        if (champ.hasError('max')) return 'Valeur trop grande.';
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

        const v = this.formulaire.getRawValue();
        const donnees: BienSaisie = {
            proprietaire_id: v.proprietaire_id!,
            type: v.type!,
            titre: v.titre!.trim(),
            quartier: v.quartier!.trim(),
            adresse: v.adresse!.trim(),
            surface: v.surface ?? null,
            nb_pieces: v.nb_pieces ?? null,
            loyer_propose: v.loyer_propose!,
            caution: v.caution ?? null,
            taux_commission: v.taux_commission ?? null,
            description: v.description?.trim() || null,
        };

        const b = this.bien();
        const requete = b ? this.service.modifier(b.id, donnees) : this.service.creer(donnees);

        requete.subscribe({
            next: (r) => this.enregistre.emit({ message: r.message, bienId: r.bien.id, creation: !b }),
            error: (e: HttpErrorResponse) => {
                this.chargement.set(false);
                if (e.status === 422 && e.error?.errors) {
                    this.erreursServeur.set(e.error.errors);
                    this.erreurGenerale.set('Certains champs sont à corriger.');
                } else {
                    this.erreurGenerale.set(e.error?.message ?? 'Une erreur est survenue. Réessayez.');
                }
            },
        });
    }
}