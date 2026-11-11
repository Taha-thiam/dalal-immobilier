<?php

namespace App\Services;

use App\Models\Paiement;
use App\Models\ParametreAgence;
use App\Models\Proprietaire;
use App\Models\Reversement;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ReversementService
{
    /**
     * Paiements validés, pas encore reversés, d'un propriétaire, jusqu'à une date.
     */
    private function paiementsAReverser(int $proprietaireId, string $jusquau)
    {
        return Paiement::query()
            ->where('statut', 'valide')
            ->whereNull('reversement_id')
            ->whereDate('date_paiement', '<=', $jusquau)
            ->whereHas('echeance.bail.bien', fn ($q) => $q->where('proprietaire_id', $proprietaireId));
    }

    /** Commission d'un paiement selon le taux du bien (10 % par défaut). */
    private function commissionDe(Paiement $p): float
    {
        $taux = (float) ($p->echeance?->bail?->bien?->taux_commission ?? 10);
        return round((float) $p->montant * $taux / 100);
    }

    /**
     * Aperçu : ce que l'agence doit à chaque propriétaire, sans rien enregistrer.
     */
    public function apercu(string $jusquau): Collection
    {
        return Proprietaire::with('user')->get()
            ->map(function (Proprietaire $prop) use ($jusquau) {
                $paiements = $this->paiementsAReverser($prop->id, $jusquau)
                    ->with('echeance.bail.bien')->get();

                if ($paiements->isEmpty()) {
                    return null;
                }

                $brut = $paiements->sum(fn ($p) => (float) $p->montant);
                $commission = $paiements->sum(fn ($p) => $this->commissionDe($p));

                return [
                    'proprietaire_id' => $prop->id,
                    'nom'             => $prop->user?->nom,
                    'prenom'          => $prop->user?->prenom,
                    'telephone'       => $prop->user?->telephone,
                    'nb_paiements'    => $paiements->count(),
                    'montant_brut'    => $brut,
                    'commission'      => $commission,
                    'montant_net'     => $brut - $commission,
                ];
            })
            ->filter()
            ->values();
    }

    /**
     * Crée le reversement d'un propriétaire et « tamponne » les paiements inclus.
     */
    public function creer(int $proprietaireId, string $jusquau, int $userId): Reversement
    {
        $reversement = DB::transaction(function () use ($proprietaireId, $jusquau, $userId) {
            $paiements = $this->paiementsAReverser($proprietaireId, $jusquau)
                ->with('echeance.bail.bien')
                ->lockForUpdate()
                ->get();

            if ($paiements->isEmpty()) {
                throw ValidationException::withMessages([
                    'proprietaire_id' => 'Aucun loyer validé à reverser pour ce propriétaire sur cette période.',
                ]);
            }

            $brut = $paiements->sum(fn ($p) => (float) $p->montant);
            $commission = $paiements->sum(fn ($p) => $this->commissionDe($p));

            $reversement = Reversement::create([
                'numero'          => $this->nouveauNumero(),
                'proprietaire_id' => $proprietaireId,
                'periode_debut'   => $paiements->min('date_paiement'),
                'periode_fin'     => $jusquau,
                'montant_brut'    => $brut,
                'commission'      => $commission,
                'montant_net'     => $brut - $commission,
                'statut'          => Reversement::A_PAYER,
                'cree_par'        => $userId,
            ]);

            // Le tampon « REVERSÉ » : ces paiements ne seront plus jamais repris
            Paiement::whereIn('id', $paiements->pluck('id'))->update(['reversement_id' => $reversement->id]);

            return $reversement;
        });

        $this->genererReleve($reversement);

        return $reversement->fresh('proprietaire.user');
    }

    /** L'agence a viré l'argent au propriétaire : a_payer -> paye. */
    public function payer(Reversement $reversement, array $donnees, int $userId): Reversement
    {
        return DB::transaction(function () use ($reversement, $donnees, $userId) {
            $r = Reversement::whereKey($reversement->id)->lockForUpdate()->firstOrFail();

            if ($r->statut !== Reversement::A_PAYER) {
                throw ValidationException::withMessages(['statut' => 'Ce reversement a déjà été payé.']);
            }
            if ($donnees['mode'] !== 'especes' && empty($donnees['reference'])) {
                throw ValidationException::withMessages([
                    'reference' => 'La référence du virement est obligatoire (sauf espèces).',
                ]);
            }

            $r->update([
                'statut'        => Reversement::PAYE,
                'date_paiement' => $donnees['date'],
                'mode_paiement' => $donnees['mode'],
                'reference'     => $donnees['reference'] ?? null,
                'paye_par'      => $userId,
            ]);

            return $r;
        });
    }

    /** Erreur de calcul ? On supprime le reversement (s'il n'est pas payé) et on libère les paiements. */
    public function supprimer(Reversement $reversement): void
    {
        if ($reversement->statut === Reversement::PAYE) {
            throw ValidationException::withMessages(['statut' => 'Un reversement payé ne peut pas être supprimé.']);
        }

        DB::transaction(function () use ($reversement) {
            Paiement::where('reversement_id', $reversement->id)->update(['reversement_id' => null]);
            if ($reversement->releve_path) {
                Storage::disk('local')->delete($reversement->releve_path);
            }
            $reversement->delete();
        });
    }

    /** Relevé PDF détaillé, rangé dans le disque privé. */
    public function genererReleve(Reversement $reversement): string
    {
        $reversement->load('proprietaire.user');

        $lignes = $reversement->paiements()
            ->with(['echeance.bail.bien', 'echeance.bail.locataire.user'])
            ->orderBy('date_paiement')
            ->get()
            ->map(function (Paiement $p) {
                $bail = $p->echeance?->bail;
                $commission = $this->commissionDe($p);
                return [
                    'date'       => $p->date_paiement,
                    'bail'       => $bail?->numero,
                    'bien'       => $bail?->bien?->titre,
                    'locataire'  => trim(($bail?->locataire?->user?->prenom ?? '') . ' ' . ($bail?->locataire?->user?->nom ?? '')),
                    'mois'       => $p->echeance?->mois,
                    'montant'    => (float) $p->montant,
                    'taux'       => (float) ($bail?->bien?->taux_commission ?? 10),
                    'commission' => $commission,
                    'net'        => (float) $p->montant - $commission,
                ];
            });

        $pdf = Pdf::loadView('pdf.releve-reversement', [
            'reversement' => $reversement,
            'proprietaire' => $reversement->proprietaire?->user,
            'lignes'      => $lignes,
            'agence'      => ParametreAgence::first(),
        ])->setPaper('a4');

        $chemin = "releves/{$reversement->numero}.pdf";
        Storage::disk('local')->put($chemin, $pdf->output());
        $reversement->update(['releve_path' => $chemin]);

        return $chemin;
    }

    /** REV-2026-0001, REV-2026-0002… */
    private function nouveauNumero(): string
    {
        $annee = now()->year;
        $dernier = Reversement::where('numero', 'like', "REV-{$annee}-%")
            ->orderByDesc('numero')
            ->value('numero');

        $suivant = $dernier ? ((int) substr($dernier, -4)) + 1 : 1;

        return sprintf('REV-%d-%04d', $annee, $suivant);
    }
}