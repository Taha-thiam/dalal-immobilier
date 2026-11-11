<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reversement;
use App\Services\ReversementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReversementController extends Controller
{
    public function __construct(private ReversementService $service) {}

    /** GET /reversements/apercu?jusquau=2026-11-30 : ce qui est dû, sans rien enregistrer. */
    public function apercu(Request $request): JsonResponse
    {
        $request->validate(['jusquau' => ['nullable', 'date']]);
        $jusquau = $request->query('jusquau', now()->toDateString());

        $lignes = $this->service->apercu($jusquau);

        return response()->json([
            'jusquau'     => $jusquau,
            'lignes'      => $lignes,
            'total_brut'  => $lignes->sum('montant_brut'),
            'total_com'   => $lignes->sum('commission'),
            'total_net'   => $lignes->sum('montant_net'),
        ]);
    }

    /** GET /reversements : l'historique, filtrable. */
    public function index(Request $request): JsonResponse
    {
        $requete = Reversement::with('proprietaire.user')->withCount('paiements')->latest('id');

        if ($statut = $request->query('statut')) {
            $requete->where('statut', $statut);
        }

        if ($texte = trim((string) $request->query('recherche', ''))) {
            $motif = "%{$texte}%";
            $requete->where(function ($q) use ($motif) {
                $q->where('numero', 'ilike', $motif)
                  ->orWhereHas('proprietaire.user', fn ($u) => $u
                      ->where('nom', 'ilike', $motif)
                      ->orWhere('prenom', 'ilike', $motif));
            });
        }

        return response()->json(
            $requete->paginate(15)->through(fn (Reversement $r) => $this->format($r))
        );
    }

    /** POST /reversements : créer le reversement d'un propriétaire. */
    public function store(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'proprietaire_id' => ['required', 'integer', 'exists:proprietaires,id'],
            'jusquau'         => ['required', 'date', 'before_or_equal:today'],
        ]);

        $r = $this->service->creer($donnees['proprietaire_id'], $donnees['jusquau'], $request->user()->id);

        return response()->json([
            'message'     => "Reversement {$r->numero} préparé : " . $this->fcfa($r->montant_net) . ' à verser.',
            'reversement' => $this->format($r->loadCount('paiements')),
        ], 201);
    }

    /** PATCH /reversements/{id}/payer */
    public function payer(Request $request, Reversement $reversement): JsonResponse
    {
        $donnees = $request->validate([
            'date'      => ['required', 'date', 'before_or_equal:today'],
            'mode'      => ['required', 'string', 'max:30'],
            'reference' => ['nullable', 'string', 'max:100'],
        ]);

        $r = $this->service->payer($reversement, $donnees, $request->user()->id);
        $this->service->genererReleve($r); // le relevé affiche maintenant « PAYÉ »

        return response()->json([
            'message'     => "Reversement {$r->numero} payé.",
            'reversement' => $this->format($r->fresh('proprietaire.user')->loadCount('paiements')),
        ]);
    }

    /** DELETE /reversements/{id} : seulement s'il n'est pas encore payé. */
    public function destroy(Reversement $reversement): JsonResponse
    {
        $numero = $reversement->numero;
        $this->service->supprimer($reversement);

        return response()->json(['message' => "Reversement {$numero} supprimé : les loyers redeviennent à reverser."]);
    }

    /** GET /reversements/{id}/releve : télécharger le PDF (disque privé). */
    public function releve(Reversement $reversement): StreamedResponse|JsonResponse
    {
        $chemin = $reversement->releve_path;

        if (! $chemin || ! Storage::disk('local')->exists($chemin)) {
            return response()->json(['message' => 'Relevé introuvable. Utilisez « Régénérer ».'], 404);
        }

        return Storage::disk('local')->download($chemin, "{$reversement->numero}.pdf", [
            'Content-Type' => 'application/pdf',
        ]);
    }

    /** POST /reversements/{id}/releve : régénérer le PDF. */
    public function regenererReleve(Reversement $reversement): JsonResponse
    {
        $this->service->genererReleve($reversement);

        return response()->json(['message' => 'Relevé régénéré.']);
    }

    // ----------------------------------------------------------------

    private function format(Reversement $r): array
    {
        $user = $r->proprietaire?->user;

        return array_merge($r->toArray(), [
            'proprietaire' => $user ? [
                'id'        => $r->proprietaire_id,
                'nom'       => $user->nom,
                'prenom'    => $user->prenom,
                'telephone' => $user->telephone,
            ] : null,
        ]);
    }

    private function fcfa($v): string
    {
        return number_format((float) $v, 0, ',', ' ') . ' FCFA';
    }
}