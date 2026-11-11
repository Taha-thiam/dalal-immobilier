<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bail;
use App\Services\BailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class BailController extends Controller
{
    public function __construct(private BailService $service)
    {
    }

    /**
     * Liste paginée avec filtres.
     * GET /api/baux?recherche=fall&statut=actif&page=1
     */
    public function index(Request $request): JsonResponse
    {
        $recherche = trim((string) $request->query('recherche', ''));

        $baux = Bail::with(['bien.proprietaire.user', 'locataire.user'])
            ->when($recherche !== '', function ($q) use ($recherche) {
                $q->where(function ($w) use ($recherche) {
                    $w->where('numero', 'ilike', "%{$recherche}%")
                      ->orWhereHas('bien', fn ($b) => $b->where('titre', 'ilike', "%{$recherche}%")
                                                        ->orWhere('reference', 'ilike', "%{$recherche}%"))
                      ->orWhereHas('locataire.user', fn ($u) => $u->where('nom', 'ilike', "%{$recherche}%")
                                                                  ->orWhere('prenom', 'ilike', "%{$recherche}%"));
                });
            })
            ->when($request->filled('statut'), fn ($q) => $q->where('statut', $request->query('statut')))
            ->latest()
            ->paginate(10);

        $baux->getCollection()->transform(fn ($b) => $this->formater($b));

        return response()->json($baux);
    }

    /**
     * Création d'un bail (toute la chaîne est dans BailService).
     */
    public function store(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'bien_id' => ['required', 'integer', 'exists:biens,id'],
            'locataire_id' => ['required', 'integer', 'exists:locataires,id'],
            'type_bail' => ['required', Rule::in(['habitation', 'professionnel'])],
            'date_debut' => ['required', 'date', 'after_or_equal:' . now()->subMonths(3)->toDateString()],
            'duree_mois' => ['required', 'integer', 'min:1', 'max:120'],
            'loyer_mensuel' => ['required', 'numeric', 'min:1'],
            'charges' => ['nullable', 'numeric', 'min:0'],
            'caution' => ['nullable', 'numeric', 'min:0'],
            'avance' => ['nullable', 'numeric', 'min:0'],
            'jour_echeance' => ['required', 'integer', 'min:1', 'max:28'],
            'renouvellement_tacite' => ['required', 'boolean'],
            'preavis_mois' => ['required', 'integer', 'min:0', 'max:12'],
            'clauses' => ['nullable', 'string', 'max:5000'],
        ], [
            'date_debut.after_or_equal' => 'La date de début ne peut pas remonter à plus de 3 mois.',
            'jour_echeance.max' => 'Le jour d’échéance doit être compris entre 1 et 28.',
        ]);

        $resultat = $this->service->creer($donnees, $request->user());
        $bail = $resultat['bail'];

        return response()->json([
            'message' => $resultat['pdf_genere']
                ? 'Bail créé avec succès. Le contrat PDF est prêt.'
                : 'Bail créé avec succès, mais le contrat PDF n’a pas pu être généré. Vous pouvez le régénérer depuis la fiche du bail.',
            'bail' => $this->formater($bail->load(['bien.proprietaire.user', 'locataire.user'])),
        ], 201);
    }

    /**
     * Détail complet : échéances, caution, contrats.
     */
    public function show(Bail $bail): JsonResponse
    {
        $bail->load(['bien.proprietaire.user', 'locataire.user', 'gestionnaire', 'echeances', 'caution', 'piecesJointes']);

        return response()->json($this->formater($bail) + [
            'avance' => $bail->avance,
            'jour_echeance' => $bail->jour_echeance,
            'renouvellement_tacite' => $bail->renouvellement_tacite,
            'preavis_mois' => $bail->preavis_mois,
            'clauses' => $bail->clauses,
            'gestionnaire' => $bail->gestionnaire ? $bail->gestionnaire->prenom . ' ' . $bail->gestionnaire->nom : null,
            'caution' => $bail->caution ? [
                'montant' => $bail->caution->montant,
                'statut' => $bail->caution->statut,
                'date_encaissement' => $bail->caution->date_encaissement?->toDateString(),
            ] : null,
            'echeances' => $bail->echeances->map(fn ($e) => [
                'id' => $e->id,
                'mois' => $e->mois->toDateString(),
                'montant_du' => $e->montant_du,
                'reste_du' => $e->reste_du,
                'date_limite' => $e->date_limite->toDateString(),
                'statut' => $e->statut,
            ]),
            'contrats' => $bail->piecesJointes
                ->where('type', 'contrat_genere')
                ->sortByDesc('version')
                ->values()
                ->map(fn ($p) => [
                    'id' => $p->id,
                    'version' => $p->version,
                    'date_ajout' => $p->date_ajout?->toDateTimeString(),
                ]),
        ]);
    }

    /**
     * Téléchargement de la dernière version du contrat PDF.
     * GET /api/baux/{bail}/contrat
     */
    public function contrat(Bail $bail): StreamedResponse|JsonResponse
    {
        $contrat = $bail->piecesJointes()
            ->where('type', 'contrat_genere')
            ->orderByDesc('version')
            ->first();

        if (! $contrat || ! Storage::disk('local')->exists($contrat->fichier_url)) {
            return response()->json(['message' => 'Aucun contrat disponible. Régénérez-le.'], 404);
        }

            return Storage::disk('local')->download(
            $contrat->fichier_url,
            "Contrat-{$bail->numero}-v{$contrat->version}.pdf",
            ['Content-Type' => 'application/pdf']
        );
    }

    /**
     * Régénère le contrat (nouvelle version), par exemple après une modification.
     * POST /api/baux/{bail}/contrat
     */
    public function regenererContrat(Bail $bail): JsonResponse
    {
        try {
            $piece = $this->service->genererContrat($bail);
        } catch (Throwable $e) {
            report($e);

            return response()->json(['message' => 'La génération du contrat a échoué : ' . $e->getMessage()], 500);
        }

        return response()->json([
            'message' => 'Contrat régénéré (version ' . $piece->version . ').',
        ]);
    }

    // ----- Méthodes internes -----

    private function formater(Bail $b): array
    {
        $proprio = $b->bien?->proprietaire?->user;
        $locataire = $b->locataire?->user;

        return [
            'id' => $b->id,
            'numero' => $b->numero,
            'statut' => $b->statut,
            'type_bail' => $b->type_bail,
            'date_debut' => $b->date_debut?->toDateString(),
            'date_fin' => $b->date_fin?->toDateString(),
            'loyer_mensuel' => $b->loyer_mensuel,
            'charges' => $b->charges,
            'bien' => $b->bien ? [
                'id' => $b->bien->id,
                'reference' => $b->bien->reference,
                'titre' => $b->bien->titre,
                'quartier' => $b->bien->quartier,
            ] : null,
            'locataire' => $locataire ? [
                'id' => $b->locataire->id,
                'nom' => $locataire->nom,
                'prenom' => $locataire->prenom,
                'telephone' => $locataire->telephone,
            ] : null,
            'proprietaire' => $proprio ? [
                'nom' => $proprio->nom,
                'prenom' => $proprio->prenom,
            ] : null,
            'created_at' => $b->created_at,
        ];
    }
}