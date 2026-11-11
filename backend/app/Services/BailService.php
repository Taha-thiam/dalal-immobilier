<?php

namespace App\Services;

use App\Models\Bail;
use App\Models\Bien;
use App\Models\JournalActivite;
use App\Models\ParametreAgence;
use App\Models\PieceJointe;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Toute la logique métier des baux, au même endroit.
 * Le contrôleur reçoit la requête ; ce service applique les règles.
 */
class BailService
{
    /**
     * Crée un bail et déclenche toute la chaîne :
     * bail → échéances → caution → bien « loué » → contrat PDF.
     *
     * @return array{bail: Bail, pdf_genere: bool}
     */
    public function creer(array $donnees, User $gestionnaire): array
    {
        $bail = DB::transaction(function () use ($donnees, $gestionnaire) {

            // 1. Verrouille le bien pendant l'opération (deux gestionnaires ne peuvent pas le louer en même temps)
            $bien = Bien::whereKey($donnees['bien_id'])->lockForUpdate()->firstOrFail();

            if ($bien->statut !== Bien::STATUT_LIBRE) {
                throw ValidationException::withMessages([
                    'bien_id' => ['Ce bien n’est pas disponible (statut : ' . $bien->statut . ').'],
                ]);
            }
            if ($bien->baux()->where('statut', Bail::STATUT_ACTIF)->exists()) {
                throw ValidationException::withMessages([
                    'bien_id' => ['Ce bien a déjà un bail actif.'],
                ]);
            }

            // 2. Dates : la date de fin est calculée à partir de la durée
            $debut = Carbon::parse($donnees['date_debut'])->startOfDay();
            $duree = (int) $donnees['duree_mois'];
            $fin = $debut->copy()->addMonthsNoOverflow($duree)->subDay();

            // 3. Le bail
            $bail = Bail::create([
                'bien_id' => $bien->id,
                'locataire_id' => $donnees['locataire_id'],
                'gestionnaire_id' => $gestionnaire->id,
                'numero' => $this->nouveauNumero(),
                'type_bail' => $donnees['type_bail'] ?? 'habitation',
                'date_debut' => $debut,
                'date_fin' => $fin,
                'loyer_mensuel' => $donnees['loyer_mensuel'],
                'charges' => $donnees['charges'] ?? 0,
                'avance' => $donnees['avance'] ?? 0,
                'jour_echeance' => $donnees['jour_echeance'] ?? 5,
                'renouvellement_tacite' => $donnees['renouvellement_tacite'] ?? true,
                'preavis_mois' => $donnees['preavis_mois'] ?? 1,
                'clauses' => $donnees['clauses'] ?? null,
                'statut' => Bail::STATUT_ACTIF,
            ]);

            // 4. Une échéance par mois de location
            $this->genererEcheances($bail, $duree);

            // 5. La caution, à encaisser par le comptable
            $bail->caution()->create([
                'montant' => $donnees['caution'] ?? $bien->caution,
                'statut' => 'a_encaisser',
            ]);

            // 6. Le bien est loué : il disparaît du site public
            $bien->update(['statut' => Bien::STATUT_LOUE, 'publie' => false]);

            $this->journaliser($gestionnaire, 'creation', $bail);

            return $bail;
        });

        // 7. Le contrat PDF, APRÈS l'enregistrement : s'il échoue, le bail reste valide
        //    et le contrat pourra être régénéré (scénario d'exception E4 du cas d'utilisation).
        $pdfGenere = true;
        try {
            $this->genererContrat($bail);
        } catch (Throwable $e) {
            Log::error('Échec de génération du contrat ' . $bail->numero . ' : ' . $e->getMessage());
            $pdfGenere = false;
        }

        return ['bail' => $bail, 'pdf_genere' => $pdfGenere];
    }

    /**
     * Génère (ou régénère) le contrat PDF et l'enregistre comme pièce jointe versionnée.
     */
    public function genererContrat(Bail $bail): PieceJointe
    {
        $bail->loadMissing(['bien.proprietaire.user', 'locataire.user', 'caution']);

        $version = (int) $bail->piecesJointes()->where('type', 'contrat_genere')->max('version') + 1;

        $pdf = Pdf::loadView('pdf.contrat-bail', [
            'bail' => $bail,
            'agence' => ParametreAgence::first(),
            'caution' => $bail->caution?->montant ?? 0,
            'dateGeneration' => now()->format('d/m/Y à H:i'),
        ])->setPaper('a4');

        $chemin = "contrats/{$bail->numero}-v{$version}.pdf";
        Storage::disk('local')->put($chemin, $pdf->output());
        return $bail->piecesJointes()->create([
            'type' => 'contrat_genere',
            'fichier_url' => $chemin,
            'version' => $version,
            'date_ajout' => now(),
        ]);
    }

    // ----- Méthodes internes -----

    /**
     * Une échéance par mois, du mois de début au dernier mois du bail.
     * Exemple : bail du 01/11/2026 pour 12 mois → échéances de novembre 2026 à octobre 2027.
     */
    private function genererEcheances(Bail $bail, int $duree): void
    {
        $montant = (float) $bail->loyer_mensuel + (float) $bail->charges;
        $premierMois = $bail->date_debut->copy()->startOfMonth();

        for ($i = 0; $i < $duree; $i++) {
            $mois = $premierMois->copy()->addMonthsNoOverflow($i);
            // Le 5 du mois… ou le dernier jour si le mois est plus court (février)
            $jour = min($bail->jour_echeance, $mois->daysInMonth);

            $bail->echeances()->create([
                'mois' => $mois->toDateString(),
                'montant_du' => $montant,
                'date_limite' => $mois->copy()->day($jour)->toDateString(),
                'reste_du' => $montant,
                'statut' => 'impayee',
            ]);
        }
    }

    /** BAIL-2026-0001, BAIL-2026-0002… */
    private function nouveauNumero(): string
    {
        $suivant = (Bail::max('id') ?? 0) + 1;

        return sprintf('BAIL-%s-%04d', now()->format('Y'), $suivant);
    }

    private function journaliser(User $user, string $action, Bail $bail): void
    {
        JournalActivite::create([
            'user_id' => $user->id,
            'action' => $action,
            'entite' => 'Bail',
            'entite_id' => $bail->id,
            'date_heure' => now(),
        ]);
    }
}