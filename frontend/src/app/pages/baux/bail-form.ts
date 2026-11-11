import { Component, DestroyRef, HostListener, OnInit, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, startWith, switchMap } from 'rxjs';
import { BailService } from '../../core/services/bail.service';
import { BienService } from '../../core/services/bien.service';
import { LocataireService } from '../../core/services/locataire.service';
import { Bien } from '../../core/models/bien.model';
import { Locataire } from '../../core/models/locataire.model';
import { BailSaisie, TypeBail } from '../../core/models/bail.model';

export interface ResultatBail {
    message: string;
    bailId: number;
}

@Component({
    selector: 'app-bail-form',
    standalone: true,
    imports: [ReactiveFormsModule],
    template: `
  <div class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm" (click)="fermer()">
    <div class="w-full max-w-3xl rounded-2xl border border-noir-600 bg-noir-800 shadow-2xl glow-bleu" (click)="$event.stopPropagation()">

      <!-- En-tête + progression -->
      <div class="border-b border-noir-600 px-6 py-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-white">Nouveau bail</h2>
          <button type="button" (click)="fermer()" aria-label="Fermer" class="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 transition hover:text-neon-rouge">×</button>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2">
          @for (titre of titresEtapes; track titre; let i = $index) {
            <div>
              <div class="h-1.5 rounded-full transition-all duration-500"
                   [class]="i + 1 <= etape() ? 'bg-neon-bleu glow-bleu' : 'bg-noir-600'"></div>
              <p class="mt-1.5 text-xs font-semibold" [class]="i + 1 === etape() ? 'text-neon-bleu' : 'text-slate-500'">
                {{ i + 1 }}. {{ titre }}
              </p>
            </div>
          }
        </div>
      </div>

      <form [formGroup]="formulaire" (ngSubmit)="suivant()" class="px-6 py-5">

        @if (erreurGenerale()) {
          <div class="mb-4 rounded-xl border border-neon-rouge/50 bg-neon-rouge/10 px-4 py-3 text-sm text-neon-rouge">{{ erreurGenerale() }}</div>
        }

        <!-- ================= ÉTAPE 1 : les parties ================= -->
        @if (etape() === 1) {
          <!-- Bien -->
          <div class="relative">
            <label class="text-sm font-medium text-slate-300">Bien à louer (libres uniquement) *</label>
            @if (bienChoisi(); as b) {
              <div class="mt-1.5 flex items-center justify-between rounded-xl border border-neon-bleu/50 bg-neon-bleu/10 px-4 py-3">
                <div>
                  <p class="font-semibold text-neon-bleu">{{ b.titre }}</p>
                  <p class="text-xs text-slate-400">{{ b.reference }} · {{ b.quartier }} · {{ montant(b.loyer_propose) }}/mois</p>
                </div>
                <button type="button" (click)="bienChoisi.set(null); formulaire.controls.bien_id.setValue(null)" class="text-sm text-slate-400 hover:text-white">Changer</button>
              </div>
            } @else {
              <input type="search" autocomplete="off" placeholder="Rechercher un bien libre : titre, quartier, référence…"
                     (input)="rechercheBien$.next($any($event.target).value)" [class]="champ" />
              <ul class="mt-1 max-h-48 overflow-y-auto rounded-xl border border-noir-600 bg-noir-900">
                @for (b of biensLibres()?.data ?? []; track b.id) {
                  <li>
                    <button type="button" (click)="choisirBien(b)" class="w-full px-4 py-2.5 text-left text-sm transition hover:bg-neon-bleu/10">
                      <span class="font-semibold text-slate-200">{{ b.titre }}</span>
                      <span class="text-slate-500"> — {{ b.quartier }} · {{ montant(b.loyer_propose) }}</span>
                    </button>
                  </li>
                } @empty {
                  <li class="px-4 py-3 text-sm text-slate-500">Aucun bien libre trouvé.</li>
                }
              </ul>
            }
            @if (erreur('bien_id')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('bien_id') }}</p> }
          </div>

          <!-- Locataire -->
          <div class="relative mt-5">
            <label class="text-sm font-medium text-slate-300">Locataire *</label>
            @if (locataireChoisi(); as l) {
              <div class="mt-1.5 flex items-center justify-between rounded-xl border border-neon-bleu/50 bg-neon-bleu/10 px-4 py-3">
                <div>
                  <p class="font-semibold text-neon-bleu">{{ l.prenom }} {{ l.nom }}</p>
                  <p class="text-xs text-slate-400">{{ l.email }} · {{ l.telephone || 'pas de téléphone' }}</p>
                </div>
                <button type="button" (click)="locataireChoisi.set(null); formulaire.controls.locataire_id.setValue(null)" class="text-sm text-slate-400 hover:text-white">Changer</button>
              </div>
            } @else {
              <input type="search" autocomplete="off" placeholder="Rechercher un locataire : nom, téléphone, CNI…"
                     (input)="rechercheLocataire$.next($any($event.target).value)" [class]="champ" />
              <ul class="mt-1 max-h-48 overflow-y-auto rounded-xl border border-noir-600 bg-noir-900">
                @for (l of locataires()?.data ?? []; track l.id) {
                  <li>
                    <button type="button" (click)="choisirLocataire(l)" class="w-full px-4 py-2.5 text-left text-sm transition hover:bg-neon-bleu/10">
                      <span class="font-semibold text-slate-200">{{ l.prenom }} {{ l.nom }}</span>
                      <span class="text-slate-500"> — {{ l.telephone || l.email }}</span>
                      @if (l.baux_actifs_count > 0) { <span class="ml-2 text-xs text-neon-rouge">(déjà en location)</span> }
                    </button>
                  </li>
                } @empty {
                  <li class="px-4 py-3 text-sm text-slate-500">Aucun locataire trouvé. Créez-le d'abord dans « Locataires ».</li>
                }
              </ul>
            }
            @if (erreur('locataire_id')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('locataire_id') }}</p> }
          </div>
        }

        <!-- ================= ÉTAPE 2 : la durée ================= -->
        @if (etape() === 2) {
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-sm font-medium text-slate-300" for="type_bail">Type de bail *</label>
              <select id="type_bail" formControlName="type_bail" [class]="champ">
                <option value="habitation">Habitation</option>
                <option value="professionnel">Professionnel</option>
              </select>
            </div>

            <div>
              <label class="text-sm font-medium text-slate-300" for="date_debut">Date de début *</label>
              <input id="date_debut" type="date" formControlName="date_debut" [class]="champ" />
              @if (erreur('date_debut')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('date_debut') }}</p> }
            </div>

            <div class="md:col-span-2">
              <label class="text-sm font-medium text-slate-300">Durée *</label>
              <div class="mt-1.5 flex flex-wrap items-center gap-2">
                @for (d of [6, 12, 24, 36]; track d) {
                  <button type="button" (click)="formulaire.controls.duree_mois.setValue(d)"
                          class="rounded-xl border px-4 py-2 text-sm font-semibold transition"
                          [class]="formulaire.controls.duree_mois.value === d ? 'border-neon-bleu bg-neon-bleu/10 text-neon-bleu glow-bleu' : 'border-noir-600 text-slate-300 hover:border-neon-bleu/50'">
                    {{ d }} mois
                  </button>
                }
                <input type="number" min="1" max="120" formControlName="duree_mois"
                       class="w-28 rounded-xl border border-noir-600 bg-noir-900 px-3 py-2 text-white outline-none focus:border-neon-bleu" />
                <span class="text-sm text-slate-500">mois</span>
              </div>
              @if (erreur('duree_mois')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('duree_mois') }}</p> }
              @if (dateFin()) {
                <p class="mt-3 text-sm text-slate-400">Fin du bail : <span class="font-semibold text-neon-bleu">{{ dateFin() }}</span></p>
              }
            </div>

            <div>
              <label class="text-sm font-medium text-slate-300" for="preavis">Préavis de départ (mois) *</label>
              <input id="preavis" type="number" min="0" max="12" formControlName="preavis_mois" [class]="champ" />
            </div>

            <div class="flex items-end">
              <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-noir-600 px-4 py-3 text-sm text-slate-300">
                <input type="checkbox" formControlName="renouvellement_tacite" class="h-4 w-4 accent-cyan-400" />
                Renouvellement tacite à l'échéance
              </label>
            </div>
          </div>
        }

        <!-- ================= ÉTAPE 3 : les conditions financières ================= -->
        @if (etape() === 3) {
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-sm font-medium text-slate-300" for="loyer">Loyer mensuel (FCFA) *</label>
              <input id="loyer" type="number" min="1" step="1000" formControlName="loyer_mensuel" [class]="champ" />
              @if (erreur('loyer_mensuel')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('loyer_mensuel') }}</p> }
            </div>

            <div>
              <label class="text-sm font-medium text-slate-300" for="charges">Charges mensuelles (FCFA)</label>
              <input id="charges" type="number" min="0" step="1000" formControlName="charges" placeholder="Gardiennage, eau…" [class]="champ" />
            </div>

            <div>
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium text-slate-300" for="caution">Caution (FCFA)</label>
                <button type="button" (click)="multipleLoyer('caution', 2)" class="text-xs font-semibold text-neon-bleu hover:underline">= 2 mois</button>
              </div>
              <input id="caution" type="number" min="0" step="1000" formControlName="caution" [class]="champ" />
            </div>

            <div>
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium text-slate-300" for="avance">Avance (FCFA)</label>
                <button type="button" (click)="multipleLoyer('avance', 1)" class="text-xs font-semibold text-neon-bleu hover:underline">= 1 mois</button>
              </div>
              <input id="avance" type="number" min="0" step="1000" formControlName="avance" [class]="champ" />
            </div>

            <div>
              <label class="text-sm font-medium text-slate-300" for="jour">Jour d'échéance (1 à 28) *</label>
              <input id="jour" type="number" min="1" max="28" formControlName="jour_echeance" [class]="champ" />
              @if (erreur('jour_echeance')) { <p class="mt-1 text-xs text-neon-rouge">{{ erreur('jour_echeance') }}</p> }
            </div>

            <div class="md:col-span-2">
              <label class="text-sm font-medium text-slate-300" for="clauses">Clauses particulières</label>
              <textarea id="clauses" rows="3" formControlName="clauses" placeholder="Une clause par ligne…" [class]="champ"></textarea>
            </div>
          </div>

          <!-- Récapitulatif -->
          <div class="mt-5 rounded-xl border border-neon-rouge/50 bg-neon-rouge/5 p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-neon-rouge">À payer à la signature</p>
            <div class="mt-2 grid gap-1 text-sm">
              <div class="flex justify-between text-slate-400"><span>Caution</span><span>{{ montant(formulaire.controls.caution.value ?? 0) }}</span></div>
              <div class="flex justify-between text-slate-400"><span>Avance</span><span>{{ montant(formulaire.controls.avance.value ?? 0) }}</span></div>
              <div class="mt-1 flex justify-between border-t border-noir-600 pt-2 text-base font-bold text-white">
                <span>Total</span><span class="text-neon-rouge text-glow-rouge">{{ montant(totalSignature()) }}</span>
              </div>
            </div>
          </div>
        }

        <!-- Boutons -->
        <div class="mt-6 flex justify-between gap-3">
          <button type="button" (click)="etape() === 1 ? fermer() : etape.set(etape() - 1)"
                  class="rounded-xl border border-noir-600 px-5 py-2.5 font-semibold text-slate-300 transition hover:bg-noir-700">
            {{ etape() === 1 ? 'Annuler' : '← Retour' }}
          </button>
          <button type="submit" [disabled]="chargement()"
                  class="rounded-xl bg-neon-bleu px-6 py-2.5 font-bold text-noir-950 transition hover:glow-bleu hover:brightness-110 disabled:opacity-60">
            {{ etape() < 3 ? 'Suivant →' : (chargement() ? 'Création du bail…' : 'Créer le bail') }}
          </button>
        </div>
      </form>
    </div>
  </div>
  `,
})
export class BailForm implements OnInit {
    private fb = inject(FormBuilder);
    private bailService = inject(BailService);
    private bienService = inject(BienService);
    private locataireService = inject(LocataireService);
    private destroyRef = inject(DestroyRef);

    ferme = output<void>();
    enregistre = output<ResultatBail>();

    titresEtapes = ['Les parties', 'La durée', 'Les conditions'];
    etape = signal(1);
    chargement = signal(false);
    erreurGenerale = signal<string | null>(null);
    erreursServeur = signal<Record<string, string[]>>({});

    bienChoisi = signal<Bien | null>(null);
    locataireChoisi = signal<Locataire | null>(null);

    // Recherches (300 ms après la dernière frappe) : la liste se charge dès l'ouverture
    rechercheBien$ = new Subject<string>();
    rechercheLocataire$ = new Subject<string>();

    biensLibres = toSignal(
        this.rechercheBien$.pipe(
            startWith(''), debounceTime(300), distinctUntilChanged(),
            switchMap((t) => this.bienService.lister(1, { recherche: t, statut: 'libre' })),
        ),
    );

    locataires = toSignal(
        this.rechercheLocataire$.pipe(
            startWith(''), debounceTime(300), distinctUntilChanged(),
            switchMap((t) => this.locataireService.lister(1, t)),
        ),
    );

    champ = 'mt-1.5 w-full rounded-xl border border-noir-600 bg-noir-900 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-neon-bleu focus:glow-bleu';

    formulaire = this.fb.group({
        bien_id: [null as number | null, Validators.required],
        locataire_id: [null as number | null, Validators.required],
        type_bail: ['habitation' as TypeBail, Validators.required],
        date_debut: [this.premierDuMoisProchain(), Validators.required],
        duree_mois: [12, [Validators.required, Validators.min(1), Validators.max(120)]],
        preavis_mois: [1, [Validators.required, Validators.min(0), Validators.max(12)]],
        renouvellement_tacite: [true],
        loyer_mensuel: [null as number | null, [Validators.required, Validators.min(1)]],
        charges: [0 as number | null, Validators.min(0)],
        caution: [null as number | null, Validators.min(0)],
        avance: [null as number | null, Validators.min(0)],
        jour_echeance: [5, [Validators.required, Validators.min(1), Validators.max(28)]],
        clauses: [''],
    });

    // Valeurs suivies en direct pour les calculs
    private valeurs = toSignal(this.formulaire.valueChanges, { initialValue: this.formulaire.getRawValue() });

    dateFin = computed(() => {
        const v = this.valeurs();
        if (!v.date_debut || !v.duree_mois) return null;
        const fin = new Date(v.date_debut + 'T00:00:00');
        fin.setMonth(fin.getMonth() + Number(v.duree_mois));
        fin.setDate(fin.getDate() - 1);
        return fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    });

    totalSignature = computed(() => Number(this.valeurs().caution ?? 0) + Number(this.valeurs().avance ?? 0));

    /** Champs à valider avant de quitter chaque étape */
    private champsParEtape: Record<number, string[]> = {
        1: ['bien_id', 'locataire_id'],
        2: ['type_bail', 'date_debut', 'duree_mois', 'preavis_mois'],
        3: ['loyer_mensuel', 'charges', 'caution', 'avance', 'jour_echeance'],
    };

    ngOnInit(): void {
        this.formulaire.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.erreurGenerale.set(null));
    }

    @HostListener('document:keydown.escape')
    fermer(): void {
        if (!this.chargement()) this.ferme.emit();
    }

    choisirBien(b: Bien): void {
        this.bienChoisi.set(b);
        // Le bien propose déjà un loyer et une caution : on les reprend
        this.formulaire.patchValue({
            bien_id: b.id,
            loyer_mensuel: Number(b.loyer_propose),
            caution: Number(b.caution),
            avance: Number(b.loyer_propose),
        });
    }

    choisirLocataire(l: Locataire): void {
        this.locataireChoisi.set(l);
        this.formulaire.controls.locataire_id.setValue(l.id);
    }

    multipleLoyer(champ: 'caution' | 'avance', mois: number): void {
        const loyer = this.formulaire.controls.loyer_mensuel.value;
        if (loyer) this.formulaire.controls[champ].setValue(loyer * mois);
    }

    /** « Suivant » aux étapes 1 et 2, « Créer le bail » à l'étape 3 */
    suivant(): void {
        const champs = this.champsParEtape[this.etape()];
        const invalides = champs.filter((c) => this.formulaire.get(c)?.invalid);
        if (invalides.length) {
            champs.forEach((c) => this.formulaire.get(c)?.markAsTouched());
            return;
        }
        if (this.etape() < 3) {
            this.etape.set(this.etape() + 1);
            return;
        }
        this.creer();
    }

    erreur(nom: string): string | null {
        const serveur = this.erreursServeur()[nom];
        if (serveur?.length) return serveur[0];

        const champ = this.formulaire.get(nom);
        if (!champ || !champ.invalid || !champ.touched) return null;
        if (champ.hasError('required')) {
            if (nom === 'bien_id') return 'Choisissez un bien.';
            if (nom === 'locataire_id') return 'Choisissez un locataire.';
            return 'Ce champ est obligatoire.';
        }
        if (champ.hasError('min')) return 'Valeur trop petite.';
        if (champ.hasError('max')) return 'Valeur trop grande.';
        return 'Valeur invalide.';
    }

    private creer(): void {
        this.chargement.set(true);
        this.erreursServeur.set({});
        const v = this.formulaire.getRawValue();

        const donnees: BailSaisie = {
            bien_id: v.bien_id!,
            locataire_id: v.locataire_id!,
            type_bail: v.type_bail!,
            date_debut: v.date_debut!,
            duree_mois: Number(v.duree_mois),
            loyer_mensuel: Number(v.loyer_mensuel),
            charges: v.charges ?? 0,
            caution: v.caution ?? null,
            avance: v.avance ?? 0,
            jour_echeance: Number(v.jour_echeance),
            renouvellement_tacite: !!v.renouvellement_tacite,
            preavis_mois: Number(v.preavis_mois),
            clauses: v.clauses?.trim() || null,
        };

        this.bailService.creer(donnees).subscribe({
            next: (r) => this.enregistre.emit({ message: r.message, bailId: r.bail.id }),
            error: (e: HttpErrorResponse) => {
                this.chargement.set(false);
                if (e.status === 422 && e.error?.errors) {
                    const erreurs = e.error.errors as Record<string, string[]>;
                    this.erreursServeur.set(erreurs);
                    this.erreurGenerale.set(Object.values(erreurs)[0]?.[0] ?? 'Certains champs sont à corriger.');
                    // Revenir à l'étape qui contient la première erreur
                    const champ = Object.keys(erreurs)[0];
                    const etape = Number(Object.keys(this.champsParEtape).find((k) => this.champsParEtape[+k].includes(champ)));
                    if (etape) this.etape.set(etape);
                } else {
                    this.erreurGenerale.set(e.error?.message ?? 'Une erreur est survenue. Réessayez.');
                }
            },
        });
    }

    private premierDuMoisProchain(): string {
        const d = new Date();
        const premier = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const mm = String(premier.getMonth() + 1).padStart(2, '0');
        return `${premier.getFullYear()}-${mm}-01`;
    }

    montant(valeur: string | number): string {
        return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(valeur) || 0) + ' FCFA';
    }
}