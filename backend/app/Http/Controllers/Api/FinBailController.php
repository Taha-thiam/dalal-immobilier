<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bail;
use App\Models\ElementEdl;
use App\Models\EtatDesLieux;
use App\Services\FinBailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FinBailController extends Controller
{
    public function __construct(private FinBailService $service) {}

    /** POST /baux/{bail}/resiliation */
    public function resilier(Request $request, Bail $bail): JsonResponse
    {
        $donnees = $request->validate([
            'date_effet' => ['required', 'date'],
            'motif'      => ['required', 'string', 'min:5', 'max:1000'],
            'initiative' => ['required', Rule::in(['locataire', 'proprietaire', 'agence'])],
        ], [
            'motif.min' => 'Le motif doit contenir au moins 5 caractères.',
        ]);

        $bail = $this->service->resilier($bail, $donnees);
        $n = (int) $bail->echeances_supprimees;

        return response()->json([
            'message' => 'Résiliation enregistrée : sortie prévue le '
                . $bail->date_resiliation->format('d/m/Y')
                . ($n > 0 ? " ({$n} mois futur(s) retiré(s) de l'échéancier)." : '.'),
            'bail'    => $bail,
        ]);
    }

    /** POST /baux/{bail}/etat-des-lieux-sortie : ouvre (ou reprend) le brouillon */
    public function ouvrirEdlSortie(Request $request, Bail $bail): JsonResponse
    {
        $edl = $this->service->ouvrirEdlSortie($bail, $request->user()->id);

        return response()->json($this->formatEdl($edl));
    }

    /** GET /etats-des-lieux/{etatDesLieux} */
    public function afficherEdl(EtatDesLieux $etatDesLieux): JsonResponse
    {
        return response()->json($this->formatEdl($etatDesLieux->load('elements')));
    }

    /** PUT /etats-des-lieux/{etatDesLieux} : enregistrer le brouillon */
    public function enregistrerEdl(Request $request, EtatDesLieux $etatDesLieux): JsonResponse
    {
        $donnees = $request->validate([
            'date_edl'                   => ['required', 'date'],
            'observations'               => ['nullable', 'string', 'max:3000'],
            'index_eau'                  => ['nullable', 'string', 'max:30'],
            'index_electricite'          => ['nullable', 'string', 'max:30'],
            'nb_cles'                    => ['nullable', 'integer', 'min:0', 'max:50'],
            'elements'                   => ['required', 'array', 'min:1'],
            'elements.*.piece'           => ['required', 'string', 'max:60'],
            'elements.*.element'         => ['required', 'string', 'max:80'],
            'elements.*.etat'            => ['required', Rule::in(ElementEdl::ETATS)],
            'elements.*.commentaire'     => ['nullable', 'string', 'max:500'],
            'elements.*.montant_retenue' => ['nullable', 'numeric', 'min:0'],
        ]);

        $edl = $this->service->enregistrerEdl($etatDesLieux, $donnees);

        return response()->json([
            'message' => 'État des lieux enregistré.',
            'edl'     => $this->formatEdl($edl),
        ]);
    }

    /** PATCH /etats-des-lieux/{etatDesLieux}/validation */
    public function validerEdl(EtatDesLieux $etatDesLieux): JsonResponse
    {
        $edl = $this->service->validerEdl($etatDesLieux);

        return response()->json([
            'message' => 'État des lieux validé et verrouillé.',
            'edl'     => $this->formatEdl($edl),
        ]);
    }

    /** POST /baux/{bail}/cloture */
    public function cloturer(Bail $bail): JsonResponse
    {
        $r = $this->service->cloturer($bail);

        $message = 'Bail clôturé : le bien est de nouveau libre.';
        if ($r['total_retenues'] > 0) {
            $message .= ' Retenue de ' . $this->fcfa($r['total_retenues']) . ' reportée sur la caution.';
        }
        if ($r['impayes'] > 0) {
            $message .= ' ⚠ Il reste ' . $this->fcfa($r['impayes']) . ' de loyers impayés.';
        }

        return response()->json(['message' => $message] + $r);
    }

    // ----------------------------------------------------------------

    private function formatEdl(EtatDesLieux $edl): array
    {
        $bail = Bail::with(['bien', 'locataire.user'])->find($edl->bail_id);
        $user = $bail?->locataire?->user;

        return array_merge($edl->toArray(), [
            'bail' => $bail ? [
                'id'               => $bail->id,
                'numero'           => $bail->numero,
                'statut'           => $bail->statut,
                'date_resiliation' => $bail->date_resiliation,
                'bien'             => $bail->bien?->titre,
                'locataire'        => $user ? trim("{$user->prenom} {$user->nom}") : null,
            ] : null,
        ]);
    }

    private function fcfa($v): string
    {
        return number_format((float) $v, 0, ',', ' ') . ' FCFA';
    }
}