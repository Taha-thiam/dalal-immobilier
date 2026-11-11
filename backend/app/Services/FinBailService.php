<?php

namespace App\Services;

use App\Models\Bail;
use App\Models\Caution;
use App\Models\Echeance;
use App\Models\ElementEdl;
use App\Models\EtatDesLieux;
use App\Models\Paiement;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Models\Bien;

class FinBailService
{
    /** Statuts où le bail est terminé : plus aucune action possible. */
    public const STATUTS_FINAUX = ['termine', 'resilie', 'renouvele'];

    /** Modèle d'état des lieux quand il n'y a pas d'état des lieux d'entrée à recopier. */
    private const MODELE = [
        'Salon' => ['Murs', 'Sol', 'Plafond', 'Porte', 'Fenêtres / vitres', 'Prises / interrupteurs'],
        'Cuisine' => ['Murs', 'Sol', 'Évier / robinetterie', 'Placards', 'Fenêtres / vitres', 'Prises / interrupteurs'],
        'Chambre' => ['Murs', 'Sol', 'Porte', 'Fenêtres / vitres', 'Placard', 'Prises / interrupteurs'],
        'Salle de bain' => ['Murs / faïence', 'Sol', 'Lavabo', 'Douche / baignoire', 'WC', 'Robinetterie'],
        'Général' => ['Porte d\'entrée / serrure', 'Climatisation', 'Compteurs'],
    ];

    private function verifierModifiable(Bail $bail): void
    {
        if (in_array($bail->statut, self::STATUTS_FINAUX, true)) {
            throw ValidationException::withMessages([
                'statut' => "Ce bail est déjà clos (statut : {$bail->statut}).",
            ]);
        }
    }

    // =====================================================================
    // 1. RÉSILIER : on fixe la date de sortie
    // =====================================================================
    public function resilier(Bail $bail, array $donnees): Bail
    {
        return DB::transaction(function () use ($bail, $donnees) {
            $bail = Bail::whereKey($bail->id)->lockForUpdate()->firstOrFail();
            $this->verifierModifiable($bail);

            $dateEffet = Carbon::parse($donnees['date_effet']);

            if ($dateEffet->lt(Carbon::parse($bail->date_debut)) || $dateEffet->gt(Carbon::parse($bail->date_fin))) {
                throw ValidationException::withMessages([
                    'date_effet' => 'La date de sortie doit être comprise entre le début et la fin du bail.',
                ]);
            }

            // Mois postérieurs à la sortie et SANS AUCUN paiement : ils n'ont plus lieu d'être
            $avecPaiement = Paiement::whereNotNull('echeance_id')->select('echeance_id');
            $supprimees = Echeance::where('bail_id', $bail->id)
                ->where('mois', '>', $dateEffet->toDateString())
                ->whereNotIn('id', $avecPaiement)
                ->delete();

            $bail->update([
                'statut' => 'en_preavis',
                'date_resiliation' => $dateEffet->toDateString(),
                'motif_resiliation' => $donnees['motif'],
                'initiative' => $donnees['initiative'],
            ]);

            $bail->setAttribute('echeances_supprimees', $supprimees);

            return $bail;
        });
    }

    // =====================================================================
    // 2. ÉTAT DES LIEUX DE SORTIE
    // =====================================================================

    /** Ouvre (ou reprend) le brouillon d'état des lieux de sortie, pré-rempli. */
    public function ouvrirEdlSortie(Bail $bail, int $userId): EtatDesLieux
    {
        $this->verifierModifiable($bail);

        $existant = EtatDesLieux::where('bail_id', $bail->id)->where('type', EtatDesLieux::SORTIE)->first();
        if ($existant) {
            return $existant->load('elements');
        }

        return DB::transaction(function () use ($bail, $userId) {
            $edl = EtatDesLieux::create([
                'bail_id' => $bail->id,
                'type' => EtatDesLieux::SORTIE,
                'date_edl' => now()->toDateString(),
                'statut' => EtatDesLieux::BROUILLON,
                'realise_par' => $userId,
            ]);

            // On recopie la liste de l'état des lieux d'ENTRÉE s'il existe, sinon le modèle standard
            $entree = EtatDesLieux::with('elements')
                ->where('bail_id', $bail->id)->where('type', EtatDesLieux::ENTREE)->first();

            $lignes = $entree && $entree->elements->isNotEmpty()
                ? $entree->elements->map(fn($e) => ['piece' => $e->piece, 'element' => $e->element])
                : collect(self::MODELE)->flatMap(fn($elements, $piece) =>
                    collect($elements)->map(fn($el) => ['piece' => $piece, 'element' => $el]));

            foreach ($lignes as $l) {
                ElementEdl::create([
                    'etat_des_lieux_id' => $edl->id,
                    'piece' => $l['piece'],
                    'element' => $l['element'],
                    'etat' => 'bon',
                    'montant_retenue' => 0,
                ]);
            }

            return $edl->load('elements');
        });
    }

    /** Enregistre le brouillon (toutes les lignes sont remplacées). */
    public function enregistrerEdl(EtatDesLieux $edl, array $donnees): EtatDesLieux
    {
        if ($edl->estValide()) {
            throw ValidationException::withMessages(['statut' => 'Cet état des lieux est validé : il ne peut plus être modifié.']);
        }

        return DB::transaction(function () use ($edl, $donnees) {
            $edl->elements()->delete();

            $total = 0;
            foreach ($donnees['elements'] as $e) {
                $retenue = (float) ($e['montant_retenue'] ?? 0);
                $total += $retenue;

                ElementEdl::create([
                    'etat_des_lieux_id' => $edl->id,
                    'piece' => $e['piece'],
                    'element' => $e['element'],
                    'etat' => $e['etat'],
                    'commentaire' => $e['commentaire'] ?? null,
                    'montant_retenue' => $retenue,
                ]);
            }

            $edl->update([
                'date_edl' => $donnees['date_edl'],
                'observations' => $donnees['observations'] ?? null,
                'index_eau' => $donnees['index_eau'] ?? null,
                'index_electricite' => $donnees['index_electricite'] ?? null,
                'nb_cles' => $donnees['nb_cles'] ?? null,
                'total_retenues' => $total,
            ]);

            return $edl->fresh('elements');
        });
    }

    /** Signature : l'état des lieux est figé. */
    public function validerEdl(EtatDesLieux $edl): EtatDesLieux
    {
        if ($edl->estValide()) {
            throw ValidationException::withMessages(['statut' => 'Cet état des lieux est déjà validé.']);
        }

        $mauvaisSansCommentaire = $edl->elements()
            ->where('etat', 'mauvais')
            ->where(fn($q) => $q->whereNull('commentaire')->orWhere('commentaire', ''))
            ->count();

        if ($mauvaisSansCommentaire > 0) {
            throw ValidationException::withMessages([
                'elements' => "{$mauvaisSansCommentaire} élément(s) en mauvais état sans commentaire : décrivez le dégât avant de valider.",
            ]);
        }

        $edl->update(['statut' => EtatDesLieux::VALIDE]);

        return $edl->fresh('elements');
    }

    // =====================================================================
    // 4. RENOUVELER : le locataire reste, un nouveau bail prend le relais
    // =====================================================================
    public function renouveler(Bail $bail, array $donnees): Bail
    {
        $nouveau = DB::transaction(function () use ($bail, $donnees) {
            $ancien = Bail::whereKey($bail->id)->lockForUpdate()->firstOrFail();

            if ($ancien->statut !== 'actif') {
                throw ValidationException::withMessages([
                    'statut' => 'Seul un bail actif peut être renouvelé (un bail en préavis se termine).',
                ]);
            }
            if (Bail::where('bail_precedent_id', $ancien->id)->exists()) {
                throw ValidationException::withMessages(['statut' => 'Ce bail a déjà été renouvelé.']);
            }

            $debut = Carbon::parse($ancien->date_fin)->addDay();
            $duree = (int) $donnees['duree_mois'];
            $fin = $debut->copy()->addMonths($duree)->subDay();
            $loyer = (float) ($donnees['loyer_mensuel'] ?? $ancien->loyer_mensuel);
            $charges = (float) ($donnees['charges'] ?? $ancien->charges ?? 0);

            // 1) Le nouveau bail : copie de l'ancien, puis on change ce qui doit changer
            $nouveau = $ancien->replicate([
                'numero',
                'statut',
                'date_resiliation',
                'motif_resiliation',
                'initiative',
                'date_cloture',
                'bail_precedent_id',
            ]);
            $nouveau->numero = $this->nouveauNumeroBail();
            $nouveau->statut = 'actif';
            $nouveau->date_debut = $debut->toDateString();
            $nouveau->date_fin = $fin->toDateString();
            $nouveau->loyer_mensuel = $loyer;
            $nouveau->charges = $charges;
            $nouveau->bail_precedent_id = $ancien->id;
            if (array_key_exists('duree_mois', $ancien->getAttributes())) {
                $nouveau->duree_mois = $duree;
            }
            $nouveau->save();

            // 2) Les échéances : copies d'une échéance de l'ancien bail (même structure)
            $modele = Echeance::where('bail_id', $ancien->id)->orderBy('mois')->first();
            $jour = (int) ($ancien->jour_echeance ?: 5);

            for ($i = 0; $i < $duree; $i++) {
                $mois = $debut->copy()->startOfMonth()->addMonths($i);
                $e = $modele ? $modele->replicate() : new Echeance();
                $e->bail_id = $nouveau->id;
                $e->mois = $mois->toDateString();
                $e->date_limite = $mois->copy()->day(min($jour, $mois->daysInMonth))->toDateString();
                $e->montant_du = $loyer + $charges;
                $e->reste_du = $loyer + $charges;
                $e->statut = 'impayee';
                $e->save();
            }

            // 3) La caution suit le locataire : elle passe sur le nouveau bail
            Caution::where('bail_id', $ancien->id)->update(['bail_id' => $nouveau->id]);

            // 4) L'ancien bail est clos comme « renouvelé »
            $ancien->update(['statut' => 'renouvele', 'date_cloture' => $ancien->date_fin]);

            return $nouveau;
        });

        // 5) Le contrat PDF du nouveau bail (sinon : bouton « Régénérer » sur la fiche)
        try {
            app(BailService::class)->genererContrat($nouveau);
        } catch (\Throwable) {
        }

        return $nouveau->fresh();
    }

    /** BAIL-2026-0003… */
    private function nouveauNumeroBail(): string
    {
        $annee = now()->year;
        $dernier = Bail::where('numero', 'like', "BAIL-{$annee}-%")->orderByDesc('numero')->value('numero');
        $suivant = $dernier ? ((int) substr($dernier, -4)) + 1 : 1;

        return sprintf('BAIL-%d-%04d', $annee, $suivant);
    }

    // =====================================================================
    // 3. CLÔTURER : le bien est libéré, la retenue passe à la caution
    // =====================================================================
    public function cloturer(Bail $bail): array
    {
        return DB::transaction(function () use ($bail) {
            $bail = Bail::with('bien')->whereKey($bail->id)->lockForUpdate()->firstOrFail();
            $this->verifierModifiable($bail);

            $edl = EtatDesLieux::where('bail_id', $bail->id)->where('type', EtatDesLieux::SORTIE)->first();

            if (!$edl || !$edl->estValide()) {
                throw ValidationException::withMessages([
                    'etat_des_lieux' => "L'état des lieux de sortie doit être réalisé et validé avant de clôturer le bail.",
                ]);
            }

            $bail->update([
                'statut' => $bail->date_resiliation ? 'resilie' : 'termine',
                'date_cloture' => now()->toDateString(),
            ]);

            $bail->bien?->update(['statut' => 'libre']);

            // La retenue de l'état des lieux est reportée sur la caution (plafonnée à son montant)
            $caution = Caution::where('bail_id', $bail->id)->first();
            if ($caution && $caution->statut === Caution::ENCAISSEE) {
                $caution->update([
                    'montant_retenu' => min((float) $edl->total_retenues, (float) $caution->montant),
                    'motif_retenue' => (float) $edl->total_retenues > 0
                        ? "Dégâts constatés à l'état des lieux de sortie du " . Carbon::parse($edl->date_edl)->format('d/m/Y')
                        : null,
                ]);
            }

            // Information utile : reste-t-il des loyers impayés ?
            $impayes = (float) Echeance::where('bail_id', $bail->id)->sum('reste_du');

            return [
                'bail' => $bail->fresh(),
                'total_retenues' => (float) $edl->total_retenues,
                'impayes' => $impayes,
                'caution' => $caution?->fresh(),
            ];
        });
    }
}