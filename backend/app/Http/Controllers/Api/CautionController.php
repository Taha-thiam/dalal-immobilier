<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Caution;
use App\Services\CautionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CautionController extends Controller
{
    public function __construct(private CautionService $service) {}

    /** Liste paginée, filtrable par statut et par recherche (n° de bail, locataire). */
    public function index(Request $request): JsonResponse
    {
        $requete = Caution::query()
            ->with(['bail.bien', 'bail.locataire.user'])
            ->latest('id');

        if ($statut = $request->query('statut')) {
            $requete->where('statut', $statut);
        }

        if ($texte = trim((string) $request->query('recherche', ''))) {
            $motif = "%{$texte}%";
            $requete->where(function ($q) use ($motif) {
                $q->whereHas('bail', fn ($b) => $b->where('numero', 'ilike', $motif))
                  ->orWhereHas('bail.locataire.user', fn ($u) => $u
                      ->where('nom', 'ilike', $motif)
                      ->orWhere('prenom', 'ilike', $motif));
            });
        }

        $page = $requete->paginate(15)->through(fn (Caution $c) => $this->format($c));

        return response()->json($page);
    }

    public function encaisser(Request $request, Caution $caution): JsonResponse
    {
        $donnees = $request->validate([
            'date'      => ['required', 'date', 'before_or_equal:today'],
            'mode'      => ['required', 'string', 'max:30'],
            'reference' => ['nullable', 'string', 'max:100'],
        ]);

        $caution = $this->service->encaisser($caution, $donnees, $request->user()->id);

        return response()->json([
            'message' => 'Caution encaissée.',
            'caution' => $this->format($caution->load(['bail.bien', 'bail.locataire.user'])),
        ]);
    }

    public function restituer(Request $request, Caution $caution): JsonResponse
    {
        $donnees = $request->validate([
            'date'           => ['required', 'date', 'before_or_equal:today'],
            'mode'           => ['required', 'string', 'max:30'],
            'montant_retenu' => ['nullable', 'numeric', 'min:0'],
            'motif_retenue'  => ['nullable', 'string', 'max:1000'],
        ]);

        $caution = $this->service->restituer($caution, $donnees, $request->user()->id);

        $rendu = number_format((float) $caution->montant_rembourse, 0, ',', ' ');

        return response()->json([
            'message' => "Caution restituée : {$rendu} FCFA rendus au locataire.",
            'caution' => $this->format($caution->load(['bail.bien', 'bail.locataire.user'])),
        ]);
    }

    /** Aplatit les relations pour que le front reçoive locataire / bien / bail directement. */
    private function format(Caution $c): array
    {
        $bail = $c->bail;
        $user = $bail?->locataire?->user;

        return array_merge($c->toArray(), [
            'bail'      => $bail ? [
                'id'         => $bail->id,
                'numero'     => $bail->numero,
                'date_debut' => $bail->date_debut,
                'date_fin'   => $bail->date_fin,
                'statut'     => $bail->statut,
            ] : null,
            'bien'      => $bail?->bien ? [
                'id'        => $bail->bien->id,
                'titre'     => $bail->bien->titre,
                'reference' => $bail->bien->reference,
            ] : null,
            'locataire' => $user ? [
                'nom'       => $user->nom,
                'prenom'    => $user->prenom,
                'telephone' => $user->telephone,
            ] : null,
        ]);
    }
}