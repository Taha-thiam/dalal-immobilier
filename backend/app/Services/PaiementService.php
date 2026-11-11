<?php

namespace App\Services;

use App\Models\Echeance;
use App\Models\JournalActivite;
use App\Models\Paiement;
use App\Models\ParametreAgence;
use App\Models\Quittance;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Logique métier des paiements de loyer :
 * enregistrer → valider (met à jour l'échéance, génère la quittance) → annuler si besoin.
 */
class PaiementService
{
    /** Statuts d'un paiement pas encore validé (en attente) */
    private const EN_ATTENTE = ['declare', 'enregistre'];

    /**
     * Enregistre un paiement sur une échéance (sans encore toucher au reste dû).
     * $statut = 'enregistre' (saisi par le comptable) ou 'declare' (déclaré par le locataire).
     */
    public function enregistrer(Echeance $echeance, array $donnees, ?User $auteur, string $statut = 'enregistre'): Paiement
    {
        return DB::transaction(function () use ($echeance, $donnees, $auteur, $statut) {
            $echeance = Echeance::whereKey($echeance->id)->lockForUpdate()->firstOrFail();

            if ($echeance->statut === 'payee') {
                throw ValidationException::withMessages(['echeance_id' => ['Cette échéance est déjà entièrement payée.']]);
            }

            // Le montant ne peut pas dépasser ce qui reste dû, moins les paiements déjà en attente
            $enAttente = (float) $echeance->paiements()->whereIn('statut', self::EN_ATTENTE)->sum('montant');
            $disponible = round((float) $echeance->reste_du - $enAttente, 2);
            $montant = round((float) $donnees['montant'], 2);

            if ($montant > $disponible) {
                throw ValidationException::withMessages([
                    'montant' => ['Le montant dépasse ce qui reste à payer pour ce mois (' . number_format($disponible, 0, ',', ' ') . ' FCFA, paiements en attente déduits).'],
                ]);
            }

            $paiement = $echeance->paiements()->create([
                'comptable_id' => $statut === 'enregistre' ? $auteur?->id : null,
                'montant' => $montant,
                'date_paiement' => $donnees['date_paiement'],
                'mode_paiement' => $donnees['mode_paiement'],
                'reference' => $donnees['reference'] ?? null,
                'statut' => $statut,
            ]);

            $this->journaliser($auteur, $statut === 'declare' ? 'declaration' : 'enregistrement', $paiement);

            return $paiement;
        });
    }

    /**
     * Valide un paiement : le reste dû baisse, l'échéance change de statut,
     * et la quittance est générée si le mois est soldé.
     *
     * @return array{paiement: Paiement, quittance: ?Quittance, quittance_erreur: bool}
     */
    public function valider(Paiement $paiement, User $comptable): array
    {
        $paiement = DB::transaction(function () use ($paiement, $comptable) {
            $paiement = Paiement::whereKey($paiement->id)->lockForUpdate()->firstOrFail();

            if (! in_array($paiement->statut, self::EN_ATTENTE, true)) {
                throw ValidationException::withMessages(['paiement' => ['Seul un paiement enregistré ou déclaré peut être validé.']]);
            }

            $echeance = Echeance::whereKey($paiement->echeance_id)->lockForUpdate()->firstOrFail();
            $reste = round((float) $echeance->reste_du - (float) $paiement->montant, 2);

            if ($reste < 0) {
                throw ValidationException::withMessages(['montant' => ['Ce paiement dépasse le reste dû de l’échéance.']]);
            }

            $echeance->update([
                'reste_du' => $reste,
                'statut' => $reste == 0.0 ? 'payee' : 'partielle',
            ]);

            $paiement->update(['statut' => 'valide', 'comptable_id' => $comptable->id]);
            $this->journaliser($comptable, 'validation', $paiement);

            return $paiement;
        });

        // La quittance après la transaction : si le PDF échoue, le paiement reste validé
        $quittance = null;
        $erreur = false;
        if ($paiement->echeance->fresh()->statut === 'payee') {
            try {
                $quittance = $this->genererQuittance($paiement);
            } catch (Throwable $e) {
                Log::error('Échec de génération de la quittance du paiement ' . $paiement->id . ' : ' . $e->getMessage());
                $erreur = true;
            }
        }

        return ['paiement' => $paiement, 'quittance' => $quittance, 'quittance_erreur' => $erreur];
    }

    /**
     * Annule un paiement (erreur de saisie, fonds non reçus…).
     * S'il était validé : le reste dû remonte et la quittance du mois est retirée.
     */
    public function annuler(Paiement $paiement, string $motif, User $comptable): Paiement
    {
        return DB::transaction(function () use ($paiement, $motif, $comptable) {
            $paiement = Paiement::whereKey($paiement->id)->lockForUpdate()->firstOrFail();

            if ($paiement->statut === 'annule') {
                throw ValidationException::withMessages(['paiement' => ['Ce paiement est déjà annulé.']]);
            }

            if ($paiement->statut === 'valide') {
                $echeance = Echeance::whereKey($paiement->echeance_id)->lockForUpdate()->firstOrFail();
                $reste = min(
                    (float) $echeance->montant_du,
                    round((float) $echeance->reste_du + (float) $paiement->montant, 2)
                );

                $echeance->update([
                    'reste_du' => $reste,
                    'statut' => $reste >= (float) $echeance->montant_du ? 'impayee' : 'partielle',
                ]);

                // Le mois n'est plus soldé : on retire sa quittance (quel que soit le paiement qui la porte)
                $this->supprimerQuittancesDuMois($echeance);
            }

            $paiement->update(['statut' => 'annule', 'motif_annulation' => $motif]);
            $this->journaliser($comptable, 'annulation', $paiement);

            return $paiement;
        });
    }

    /**
     * Génère (ou régénère) la quittance PDF du mois soldé par ce paiement.
     */
    public function genererQuittance(Paiement $paiement): Quittance
    {
        $paiement->loadMissing('echeance.bail.locataire.user', 'echeance.bail.bien.proprietaire.user');

        $quittance = $paiement->quittance ?? $paiement->quittance()->create([
            'numero' => $this->nouveauNumero(),
            'date_emission' => now()->toDateString(),
        ]);
        $quittance->setRelation('paiement', $paiement);

        $paiementsDuMois = $paiement->echeance->paiements()
            ->where('statut', 'valide')
            ->orderBy('date_paiement')
            ->get();

        $pdf = Pdf::loadView('pdf.quittance', [
            'quittance' => $quittance,
            'paiements' => $paiementsDuMois,
            'agence' => ParametreAgence::first(),
        ])->setPaper('a4');

        // Stockage PRIVÉ : la quittance contient des données personnelles
        $chemin = "quittances/{$quittance->numero}.pdf";
        Storage::disk('local')->put($chemin, $pdf->output());
        $quittance->update(['fichier_url' => $chemin]);

        return $quittance;
    }

    // ----- Méthodes internes -----

    private function supprimerQuittancesDuMois(Echeance $echeance): void
    {
        $quittances = Quittance::whereIn('paiement_id', $echeance->paiements()->pluck('id'))->get();

        foreach ($quittances as $q) {
            if ($q->fichier_url) {
                Storage::disk('local')->delete($q->fichier_url);
            }
            $q->delete();
        }
    }

    /** QUI-2026-0001, QUI-2026-0002… */
    private function nouveauNumero(): string
    {
        $suivant = (Quittance::max('id') ?? 0) + 1;

        return sprintf('QUI-%s-%04d', now()->format('Y'), $suivant);
    }

    private function journaliser(?User $user, string $action, Paiement $p): void
    {
        JournalActivite::create([
            'user_id' => $user?->id,
            'action' => $action,
            'entite' => 'Paiement',
            'entite_id' => $p->id,
            'date_heure' => now(),
        ]);
    }
}