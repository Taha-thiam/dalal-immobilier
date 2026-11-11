<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Echeance;
use App\Models\Paiement;
use App\Models\Quittance;
use App\Services\PaiementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PaiementController extends Controller
{
    public const MODES = ['especes', 'wave', 'orange_money', 'virement'];

    public function __construct(private PaiementService $service)
    {
    }

    /**
     * Échéances non soldées (à encaisser), les plus anciennes d'abord.
     * GET /api/echeances?recherche=fall&en_retard=1&page=1
     */
    public function echeances(Request $request): JsonResponse
    {
        $recherche = trim((string) $request->query('recherche', ''));

        $echeances = Echeance::with(['bail.locataire.user', 'bail.bien'])
            ->withSum(['paiements as en_attente' => fn ($q) => $q->whereIn('statut', ['declare', 'enregistre'])], 'montant')
            ->whereIn('statut', ['impayee', 'partielle'])
            ->whereHas('bail', fn ($b) => $b->where('statut', 'actif'))
            ->when($request->boolean('en_retard'), fn ($q) => $q->where('date_limite', '<', now()->toDateString()))
            ->when($recherche !== '', function ($q) use ($recherche) {
                $q->whereHas('bail', function ($b) use ($recherche) {
                    $b->where('numero', 'ilike', "%{$recherche}%")
                      ->orWhereHas('bien', fn ($bi) => $bi->where('titre', 'ilike', "%{$recherche}%"))
                      ->orWhereHas('locataire.user', fn ($u) => $u->where('nom', 'ilike', "%{$recherche}%")
                                                                  ->orWhere('prenom', 'ilike', "%{$recherche}%"));
                });
            })
            ->orderBy('date_limite')
            ->paginate(15);

        $echeances->getCollection()->transform(fn ($e) => $this->formaterEcheance($e));

        return response()->json($echeances);
    }

    /**
     * Historique des paiements.
     * GET /api/paiements?statut=enregistre&recherche=fall&page=1
     */
    public function index(Request $request): JsonResponse
    {
        $recherche = trim((string) $request->query('recherche', ''));

        $paiements = Paiement::with(['echeance.bail.locataire.user', 'echeance.bail.bien', 'quittance', 'comptable'])
            ->when($request->filled('statut'), fn ($q) => $q->where('statut', $request->query('statut')))
            ->when($recherche !== '', function ($q) use ($recherche) {
                $q->where(function ($w) use ($recherche) {
                    $w->where('reference', 'ilike', "%{$recherche}%")
                      ->orWhereHas('echeance.bail', fn ($b) => $b->where('numero', 'ilike', "%{$recherche}%"))
                      ->orWhereHas('echeance.bail.locataire.user', fn ($u) => $u->where('nom', 'ilike', "%{$recherche}%")
                                                                                ->orWhere('prenom', 'ilike', "%{$recherche}%"));
                });
            })
            ->latest()
            ->paginate(15);

        $paiements->getCollection()->transform(fn ($p) => $this->formaterPaiement($p));

        return response()->json($paiements);
    }

    /**
     * Enregistrement d'un paiement par le comptable.
     */
    public function store(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'echeance_id' => ['required', 'integer', 'exists:echeances,id'],
            'montant' => ['required', 'numeric', 'min:1'],
            'date_paiement' => ['required', 'date', 'before_or_equal:today'],
            'mode_paiement' => ['required', Rule::in(self::MODES)],
            'reference' => ['nullable', 'string', 'max:100', 'unique:paiements,reference'],
        ], [
            'date_paiement.before_or_equal' => 'La date de paiement ne peut pas être dans le futur.',
            'reference.unique' => 'Cette référence de transaction a déjà été enregistrée (doublon).',
        ]);

        $echeance = Echeance::findOrFail($donnees['echeance_id']);
        $paiement = $this->service->enregistrer($echeance, $donnees, $request->user());

        return response()->json([
            'message' => 'Paiement enregistré. Validez-le après vérification de la réception des fonds.',
            'paiement' => $this->formaterPaiement($paiement->load(['echeance.bail.locataire.user', 'echeance.bail.bien', 'quittance', 'comptable'])),
        ], 201);
    }

    /**
     * Validation : met à jour l'échéance et génère la quittance si le mois est soldé.
     */
    public function valider(Request $request, Paiement $paiement): JsonResponse
    {
        $resultat = $this->service->valider($paiement, $request->user());

        $message = 'Paiement validé.';
        if ($resultat['quittance']) {
            $message .= ' Le mois est soldé : quittance ' . $resultat['quittance']->numero . ' générée.';
        } elseif ($resultat['quittance_erreur']) {
            $message .= ' Le mois est soldé, mais la quittance n’a pas pu être générée (réessayez depuis la liste).';
        } else {
            $message .= ' Le mois n’est pas encore soldé : pas de quittance pour l’instant.';
        }

        return response()->json([
            'message' => $message,
            'paiement' => $this->formaterPaiement($resultat['paiement']->fresh(['echeance.bail.locataire.user', 'echeance.bail.bien', 'quittance', 'comptable'])),
        ]);
    }

    /**
     * Annulation avec motif obligatoire.
     */
    public function annuler(Request $request, Paiement $paiement): JsonResponse
    {
        $motif = $request->validate([
            'motif' => ['required', 'string', 'min:5', 'max:255'],
        ], [
            'motif.required' => 'Indiquez le motif de l’annulation.',
            'motif.min' => 'Le motif doit faire au moins 5 caractères.',
        ])['motif'];

        $paiement = $this->service->annuler($paiement, $motif, $request->user());

        return response()->json([
            'message' => 'Paiement annulé.',
            'paiement' => $this->formaterPaiement($paiement->fresh(['echeance.bail.locataire.user', 'echeance.bail.bien', 'quittance', 'comptable'])),
        ]);
    }

    /**
     * Téléchargement de la quittance du mois réglé par ce paiement.
     * GET /api/paiements/{paiement}/quittance
     */
    public function quittance(Paiement $paiement): StreamedResponse|JsonResponse
    {
        $quittance = Quittance::whereIn('paiement_id', $paiement->echeance->paiements()->pluck('id'))->first();

        if (! $quittance || ! $quittance->fichier_url || ! Storage::disk('local')->exists($quittance->fichier_url)) {
            return response()->json(['message' => 'Aucune quittance disponible pour ce mois.'], 404);
        }

        return Storage::disk('local')->download(
            $quittance->fichier_url,
            "Quittance-{$quittance->numero}.pdf",
            ['Content-Type' => 'application/pdf']
        );
    }

    /**
     * Régénère la quittance d'un mois soldé (si la génération avait échoué).
     * POST /api/paiements/{paiement}/quittance
     */
    public function regenererQuittance(Paiement $paiement): JsonResponse
    {
        if ($paiement->statut !== 'valide' || $paiement->echeance->statut !== 'payee') {
            return response()->json(['message' => 'Une quittance ne peut être émise que pour un mois entièrement payé.'], 422);
        }

        $quittance = $this->service->genererQuittance($paiement);

        return response()->json(['message' => 'Quittance ' . $quittance->numero . ' générée.']);
    }

    // ----- Méthodes internes -----

    private function formaterEcheance(Echeance $e): array
    {
        $bail = $e->bail;
        $locataire = $bail?->locataire?->user;

        return [
            'id' => $e->id,
            'mois' => $e->mois->toDateString(),
            'montant_du' => $e->montant_du,
            'reste_du' => $e->reste_du,
            'en_attente' => (string) ($e->en_attente ?? 0),
            'date_limite' => $e->date_limite->toDateString(),
            'statut' => $e->statut,
            'en_retard' => $e->date_limite->lt(now()->startOfDay()),
            'bail' => $bail ? ['id' => $bail->id, 'numero' => $bail->numero] : null,
            'bien' => $bail?->bien ? ['id' => $bail->bien->id, 'titre' => $bail->bien->titre, 'quartier' => $bail->bien->quartier] : null,
            'locataire' => $locataire ? ['nom' => $locataire->nom, 'prenom' => $locataire->prenom, 'telephone' => $locataire->telephone] : null,
        ];
    }

    private function formaterPaiement(Paiement $p): array
    {
        $echeance = $p->echeance;
        $locataire = $echeance?->bail?->locataire?->user;

        return [
            'id' => $p->id,
            'montant' => $p->montant,
            'date_paiement' => $p->date_paiement?->toDateString(),
            'mode_paiement' => $p->mode_paiement,
            'reference' => $p->reference,
            'statut' => $p->statut,
            'motif_annulation' => $p->motif_annulation,
            'comptable' => $p->comptable ? $p->comptable->prenom . ' ' . $p->comptable->nom : null,
            'quittance' => $p->quittance ? ['numero' => $p->quittance->numero] : null,
            'echeance' => $echeance ? [
                'id' => $echeance->id,
                'mois' => $echeance->mois->toDateString(),
                'statut' => $echeance->statut,
                'reste_du' => $echeance->reste_du,
            ] : null,
            'bail' => $echeance?->bail ? ['id' => $echeance->bail->id, 'numero' => $echeance->bail->numero] : null,
            'bien' => $echeance?->bail?->bien ? ['titre' => $echeance->bail->bien->titre] : null,
            'locataire' => $locataire ? ['nom' => $locataire->nom, 'prenom' => $locataire->prenom] : null,
            'created_at' => $p->created_at,
        ];
    }
}