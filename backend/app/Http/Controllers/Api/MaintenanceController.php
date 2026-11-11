<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Intervention;
use App\Models\Signalement;
use App\Services\MaintenanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MaintenanceController extends Controller
{
    public function __construct(private MaintenanceService $service) {}

    /** GET /signalements : les plus urgents et les plus récents en premier */
    public function index(Request $request): JsonResponse
    {
        $requete = Signalement::with(['bien', 'locataire.user', 'interventions'])
            // 1) ouverts avant clôturés  2) urgence haute avant faible  3) plus récents
            ->orderByRaw("CASE WHEN statut IN ('nouveau','en_cours') THEN 0 ELSE 1 END")
            ->orderByRaw("CASE urgence WHEN 'haute' THEN 0 WHEN 'normale' THEN 1 ELSE 2 END")
            ->orderByDesc('id');

        if ($statut = $request->query('statut')) {
            $statut === 'ouverts'
                ? $requete->whereIn('statut', [Signalement::NOUVEAU, Signalement::EN_COURS])
                : $requete->where('statut', $statut);
        }

        if ($urgence = $request->query('urgence')) {
            $requete->where('urgence', $urgence);
        }

        if ($texte = trim((string) $request->query('recherche', ''))) {
            $motif = "%{$texte}%";
            $requete->where(function ($q) use ($motif) {
                $q->where('numero', 'ilike', $motif)
                  ->orWhere('titre', 'ilike', $motif)
                  ->orWhereHas('bien', fn ($b) => $b->where('titre', 'ilike', $motif)->orWhere('reference', 'ilike', $motif));
            });
        }

        return response()->json(
            $requete->paginate(15)->through(fn (Signalement $s) => $this->format($s))
        );
    }

    /** POST /signalements */
    public function store(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'bien_id'     => ['required', 'integer', 'exists:biens,id'],
            'titre'       => ['required', 'string', 'min:3', 'max:150'],
            'description' => ['nullable', 'string', 'max:3000'],
            'categorie'   => ['required', Rule::in(Signalement::CATEGORIES)],
            'urgence'     => ['required', Rule::in(Signalement::URGENCES)],
        ]);

        $s = $this->service->signaler($donnees, $request->user()->id);

        return response()->json([
            'message'     => "Signalement {$s->numero} enregistré.",
            'signalement' => $this->format($s->load(['bien', 'locataire.user', 'interventions'])),
        ], 201);
    }

    /** GET /signalements/{signalement} */
    public function show(Signalement $signalement): JsonResponse
    {
        return response()->json($this->format($signalement->load(['bien', 'locataire.user', 'interventions'])));
    }

    /** POST /signalements/{signalement}/interventions */
    public function planifier(Request $request, Signalement $signalement): JsonResponse
    {
        $donnees = $request->validate([
            'prestataire_nom'       => ['required', 'string', 'max:120'],
            'prestataire_telephone' => ['nullable', 'string', 'max:30'],
            'date_prevue'           => ['required', 'date'],
        ]);

        $this->service->planifier($signalement, $donnees, $request->user()->id);

        return response()->json([
            'message'     => 'Intervention planifiée.',
            'signalement' => $this->format($signalement->fresh(['bien', 'locataire.user', 'interventions'])),
        ], 201);
    }

    /** PATCH /interventions/{intervention}/realisation */
    public function realiser(Request $request, Intervention $intervention): JsonResponse
    {
        $donnees = $request->validate([
            'date_realisation' => ['required', 'date', 'before_or_equal:today'],
            'cout'             => ['nullable', 'numeric', 'min:0'],
            'a_charge_de'      => ['nullable', Rule::in(Intervention::CHARGES)],
            'rapport'          => ['nullable', 'string', 'max:3000'],
        ]);

        $this->service->realiser($intervention, $donnees);

        return response()->json([
            'message'     => 'Intervention marquée comme réalisée.',
            'signalement' => $this->format($intervention->signalement->fresh(['bien', 'locataire.user', 'interventions'])),
        ]);
    }

    /** PATCH /interventions/{intervention}/annulation */
    public function annulerIntervention(Request $request, Intervention $intervention): JsonResponse
    {
        $donnees = $request->validate(['motif' => ['nullable', 'string', 'max:500']]);

        $this->service->annulerIntervention($intervention, $donnees['motif'] ?? null);

        return response()->json([
            'message'     => 'Intervention annulée.',
            'signalement' => $this->format($intervention->signalement->fresh(['bien', 'locataire.user', 'interventions'])),
        ]);
    }

    /** PATCH /signalements/{signalement}/resolution */
    public function resoudre(Signalement $signalement): JsonResponse
    {
        $this->service->resoudre($signalement);

        return response()->json([
            'message'     => "Signalement {$signalement->numero} résolu.",
            'signalement' => $this->format($signalement->fresh(['bien', 'locataire.user', 'interventions'])),
        ]);
    }

    /** PATCH /signalements/{signalement}/rejet */
    public function rejeter(Request $request, Signalement $signalement): JsonResponse
    {
        $donnees = $request->validate([
            'motif' => ['required', 'string', 'min:5', 'max:1000'],
        ], ['motif.min' => 'Le motif doit contenir au moins 5 caractères.']);

        $this->service->rejeter($signalement, $donnees['motif']);

        return response()->json([
            'message'     => "Signalement {$signalement->numero} rejeté.",
            'signalement' => $this->format($signalement->fresh(['bien', 'locataire.user', 'interventions'])),
        ]);
    }

    // ----------------------------------------------------------------

    private function format(Signalement $s): array
    {
        $user = $s->locataire?->user;

        return array_merge($s->toArray(), [
            'bien' => $s->bien ? [
                'id'        => $s->bien->id,
                'titre'     => $s->bien->titre,
                'reference' => $s->bien->reference,
                'quartier'  => $s->bien->quartier,
            ] : null,
            'locataire' => $user ? [
                'nom'       => $user->nom,
                'prenom'    => $user->prenom,
                'telephone' => $user->telephone,
            ] : null,
            'cout_total' => (float) $s->interventions->where('statut', Intervention::REALISEE)->sum('cout'),
        ]);
    }
}