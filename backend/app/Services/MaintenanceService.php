<?php

namespace App\Services;

use App\Models\Bail;
use App\Models\Intervention;
use App\Models\Signalement;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MaintenanceService
{
    // =====================================================================
    // 1. SIGNALER une panne
    // =====================================================================
    public function signaler(array $donnees, int $userId): Signalement
    {
        return DB::transaction(function () use ($donnees, $userId) {
            // Le bail en cours du bien permet de retrouver automatiquement le locataire
            $bail = Bail::where('bien_id', $donnees['bien_id'])
                ->whereIn('statut', ['actif', 'en_preavis'])
                ->latest('id')
                ->first();

            return Signalement::create([
                'numero'       => $this->nouveauNumero(),
                'bien_id'      => $donnees['bien_id'],
                'bail_id'      => $bail?->id,
                'locataire_id' => $bail?->locataire_id,
                'titre'        => $donnees['titre'],
                'description'  => $donnees['description'] ?? null,
                'categorie'    => $donnees['categorie'],
                'urgence'      => $donnees['urgence'],
                'statut'       => Signalement::NOUVEAU,
                'declare_par'  => $userId,
            ]);
        });
    }

    // =====================================================================
    // 2. PLANIFIER une intervention (prestataire externe)
    // =====================================================================
    public function planifier(Signalement $signalement, array $donnees, int $userId): Intervention
    {
        $this->verifierOuvert($signalement);

        return DB::transaction(function () use ($signalement, $donnees, $userId) {
            $intervention = Intervention::create([
                'signalement_id'        => $signalement->id,
                'prestataire_nom'       => $donnees['prestataire_nom'],
                'prestataire_telephone' => $donnees['prestataire_telephone'] ?? null,
                'date_prevue'           => $donnees['date_prevue'],
                'statut'                => Intervention::PLANIFIEE,
                'planifiee_par'         => $userId,
            ]);

            $signalement->update(['statut' => Signalement::EN_COURS]);

            return $intervention;
        });
    }

    // =====================================================================
    // 3. Le technicien est passé : RÉALISÉE
    // =====================================================================
    public function realiser(Intervention $intervention, array $donnees): Intervention
    {
        if ($intervention->statut !== Intervention::PLANIFIEE) {
            throw ValidationException::withMessages([
                'statut' => 'Seule une intervention planifiée peut être marquée comme réalisée.',
            ]);
        }

        if ((float) ($donnees['cout'] ?? 0) > 0 && empty($donnees['a_charge_de'])) {
            throw ValidationException::withMessages([
                'a_charge_de' => 'Indiquez qui prend en charge le coût de la réparation.',
            ]);
        }

        $intervention->update([
            'statut'           => Intervention::REALISEE,
            'date_realisation' => $donnees['date_realisation'],
            'cout'             => $donnees['cout'] ?? 0,
            'a_charge_de'      => $donnees['a_charge_de'] ?? null,
            'rapport'          => $donnees['rapport'] ?? null,
        ]);

        return $intervention;
    }

    /** Le prestataire n'est pas venu, ou l'intervention n'est plus nécessaire. */
    public function annulerIntervention(Intervention $intervention, ?string $motif): Intervention
    {
        if ($intervention->statut !== Intervention::PLANIFIEE) {
            throw ValidationException::withMessages([
                'statut' => 'Seule une intervention planifiée peut être annulée.',
            ]);
        }

        $intervention->update([
            'statut'  => Intervention::ANNULEE,
            'rapport' => $motif ? "Annulée : {$motif}" : 'Annulée',
        ]);

        return $intervention;
    }

    // =====================================================================
    // 4. RÉSOUDRE ou REJETER le signalement
    // =====================================================================
    public function resoudre(Signalement $signalement): Signalement
    {
        $this->verifierOuvert($signalement);

        $enAttente = $signalement->interventions()->where('statut', Intervention::PLANIFIEE)->count();
        if ($enAttente > 0) {
            throw ValidationException::withMessages([
                'statut' => "{$enAttente} intervention(s) encore planifiée(s) : marquez-les réalisées ou annulées avant de clôturer.",
            ]);
        }

        $signalement->update([
            'statut'          => Signalement::RESOLU,
            'date_resolution' => now()->toDateString(),
        ]);

        return $signalement;
    }

    /** Ex. : « ce n'est pas une panne, le disjoncteur était simplement baissé ». */
    public function rejeter(Signalement $signalement, string $motif): Signalement
    {
        if ($signalement->statut !== Signalement::NOUVEAU) {
            throw ValidationException::withMessages([
                'statut' => 'Seul un signalement nouveau (sans intervention) peut être rejeté.',
            ]);
        }

        $signalement->update([
            'statut'      => Signalement::REJETE,
            'motif_rejet' => $motif,
        ]);

        return $signalement;
    }

    // ---------------------------------------------------------------------

    private function verifierOuvert(Signalement $signalement): void
    {
        if (! $signalement->estOuvert()) {
            throw ValidationException::withMessages([
                'statut' => 'Ce signalement est déjà clôturé.',
            ]);
        }
    }

    /** SIG-2026-0001, SIG-2026-0002… */
    private function nouveauNumero(): string
    {
        $annee = now()->year;
        $dernier = Signalement::where('numero', 'like', "SIG-{$annee}-%")->orderByDesc('numero')->value('numero');
        $suivant = $dernier ? ((int) substr($dernier, -4)) + 1 : 1;

        return sprintf('SIG-%d-%04d', $annee, $suivant);
    }
}