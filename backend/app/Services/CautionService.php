<?php

namespace App\Services;

use App\Models\Caution;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CautionService
{
    /**
     * Entrée dans les lieux : le comptable reçoit l'argent de la caution.
     * a_encaisser -> encaissee
     */
    public function encaisser(Caution $caution, array $donnees, int $userId): Caution
    {
        return DB::transaction(function () use ($caution, $donnees, $userId) {
            $caution = Caution::whereKey($caution->id)->lockForUpdate()->firstOrFail();

            if ($caution->statut !== Caution::A_ENCAISSER) {
                throw ValidationException::withMessages([
                    'statut' => 'Cette caution a déjà été encaissée.',
                ]);
            }

            if ($donnees['mode'] !== 'especes' && empty($donnees['reference'])) {
                throw ValidationException::withMessages([
                    'reference' => 'La référence de la transaction est obligatoire (sauf espèces).',
                ]);
            }

            $caution->update([
                'statut'                 => Caution::ENCAISSEE,
                'date_encaissement'      => $donnees['date'],
                'mode_encaissement'      => $donnees['mode'],
                'reference_encaissement' => $donnees['reference'] ?? null,
                'encaisse_par'           => $userId,
            ]);

            return $caution->fresh('bail');
        });
    }

    /**
     * Sortie des lieux : on rend la caution, moins les retenues éventuelles
     * (dégâts constatés à l'état des lieux, loyers impayés…).
     * encaissee -> restituee
     */
    public function restituer(Caution $caution, array $donnees, int $userId): Caution
    {
        return DB::transaction(function () use ($caution, $donnees, $userId) {
            $caution = Caution::whereKey($caution->id)->lockForUpdate()->firstOrFail();

            if ($caution->statut !== Caution::ENCAISSEE) {
                throw ValidationException::withMessages([
                    'statut' => $caution->statut === Caution::RESTITUEE
                        ? 'Cette caution a déjà été restituée.'
                        : "Impossible de restituer une caution qui n'a pas été encaissée.",
                ]);
            }

            $retenue = (float) ($donnees['montant_retenu'] ?? 0);
            $montant = (float) $caution->montant;

            if ($retenue > $montant) {
                throw ValidationException::withMessages([
                    'montant_retenu' => 'La retenue ne peut pas dépasser le montant de la caution ('
                        . number_format($montant, 0, ',', ' ') . ' FCFA).',
                ]);
            }

            if ($retenue > 0 && empty(trim($donnees['motif_retenue'] ?? ''))) {
                throw ValidationException::withMessages([
                    'motif_retenue' => 'Le motif est obligatoire lorsqu\'une retenue est appliquée.',
                ]);
            }

            $caution->update([
                'statut'             => Caution::RESTITUEE,
                'montant_retenu'     => $retenue,
                'motif_retenue'      => $retenue > 0 ? trim($donnees['motif_retenue']) : null,
                'montant_rembourse'  => $montant - $retenue,
                'date_remboursement' => $donnees['date'],
                'mode_remboursement' => $donnees['mode'],
                'rembourse_par'      => $userId,
            ]);

            return $caution->fresh('bail');
        });
    }
}