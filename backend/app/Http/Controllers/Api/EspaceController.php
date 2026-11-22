<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bail;
use App\Models\Bien;
use App\Models\Echeance;
use App\Models\Intervention;
use App\Models\Locataire;
use App\Models\Paiement;
use App\Models\Proprietaire;
use App\Models\Reversement;
use App\Models\Signalement;
use App\Services\MaintenanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EspaceController extends Controller
{
    private const EN_ATTENTE = ['declare', 'enregistre'];
    private const EN_COURS = ['actif', 'en_preavis'];

    // =====================================================================
    //                          ESPACE LOCATAIRE
    //       Un locataire = un compte, mais il peut avoir PLUSIEURS baux
    // =====================================================================

    private function locataire(Request $request): Locataire
    {
        return Locataire::with('user')->where('user_id', $request->user()->id)->firstOrFail();
    }

    /** Tous ses baux : ceux en cours d'abord, puis les plus récents. */
    private function bauxDe(Locataire $loc)
    {
        return Bail::with(['bien', 'echeances', 'caution'])
            ->where('locataire_id', $loc->id)
            ->orderByRaw("CASE WHEN statut IN ('actif','en_preavis') THEN 0 ELSE 1 END")
            ->latest('id')
            ->get();
    }

    /** Un bail EN COURS de ce locataire (sinon erreur claire). */
    private function bailEnCours(Locataire $loc, int $bailId): Bail
    {
        $bail = Bail::where('id', $bailId)->where('locataire_id', $loc->id)->first();

        if (!$bail) {
            throw ValidationException::withMessages(['bail_id' => 'Cette location ne fait pas partie de vos baux.']);
        }
        if (!in_array($bail->statut, self::EN_COURS, true)) {
            throw ValidationException::withMessages(['bail_id' => 'Cette location est terminée.']);
        }

        return $bail;
    }

    /** GET /mon-espace/locataire?bail_id=3 : liste de ses locations + détail de celle choisie */
    public function locataireTableau(Request $request): JsonResponse
    {
        $loc = $this->locataire($request);
        $baux = $this->bauxDe($loc);
        $aujourdhui = now()->toDateString();

        // ---- 1. La liste de ses locations (pour le sélecteur en haut de page) ----
        $liste = $baux->map(function (Bail $b) use ($aujourdhui) {
            $retards = $b->echeances->filter(fn($e) => (float) $e->reste_du > 0 && $e->date_limite < $aujourdhui);

            return [
                'id' => $b->id,
                'numero' => $b->numero,
                'statut' => $b->statut,
                'en_cours' => in_array($b->statut, self::EN_COURS, true),
                'bien' => $b->bien?->titre,
                'quartier' => $b->bien?->quartier,
                'loyer' => (float) $b->loyer_mensuel + (float) ($b->charges ?? 0),
                'nb_retard' => $retards->count(),
                'total_retard' => (float) $retards->sum('reste_du'),
            ];
        })->values();

        // ---- 2. La location affichée : celle demandée, sinon la première en cours ----
        $bail = $request->filled('bail_id')
            ? $baux->firstWhere('id', (int) $request->query('bail_id'))
            : $baux->first();

        $profil = $loc->user?->only(['nom', 'prenom', 'email', 'telephone']);

        if (!$bail) {
            return response()->json(['locataire' => $profil, 'baux' => $liste, 'bail' => null]);
        }

        $idsEcheances = $bail->echeances->pluck('id');

        $enAttente = Paiement::whereIn('echeance_id', $idsEcheances)
            ->whereIn('statut', self::EN_ATTENTE)
            ->groupBy('echeance_id')
            ->select('echeance_id', DB::raw('SUM(montant) as total'))
            ->pluck('total', 'echeance_id');

        $echeances = $bail->echeances->map(fn($e) => [
            'id' => $e->id,
            'mois' => $e->mois,
            'date_limite' => $e->date_limite,
            'montant_du' => (float) $e->montant_du,
            'reste_du' => (float) $e->reste_du,
            'en_attente' => (float) ($enAttente[$e->id] ?? 0),
            'statut' => $e->statut,
            'en_retard' => (float) $e->reste_du > 0 && $e->date_limite < $aujourdhui,
        ])->values();

        $paiements = Paiement::with(['quittance', 'echeance'])
            ->whereIn('echeance_id', $idsEcheances)
            ->latest('id')->get()
            ->map(fn($p) => [
                'id' => $p->id,
                'mois' => $p->echeance?->mois,
                'montant' => (float) $p->montant,
                'mode_paiement' => $p->mode_paiement,
                'reference' => $p->reference,
                'date_paiement' => $p->date_paiement,
                'statut' => $p->statut,
                'quittance' => $p->quittance?->numero,
            ]);

        // Les signalements de ce bien uniquement
        $signalements = Signalement::with('interventions')
            ->where('locataire_id', $loc->id)
            ->where('bien_id', $bail->bien_id)
            ->latest('id')->take(10)->get()
            ->map(fn($s) => [
                'id' => $s->id,
                'numero' => $s->numero,
                'titre' => $s->titre,
                'categorie' => $s->categorie,
                'urgence' => $s->urgence,
                'statut' => $s->statut,
                'created_at' => $s->created_at,
                'prochaine_visite' => $s->interventions->firstWhere('statut', 'planifiee')?->date_prevue,
            ]);

        $prochaine = $echeances->first(fn($e) => $e['reste_du'] - $e['en_attente'] > 0);

        return response()->json([
            'locataire' => $profil,
            'baux' => $liste,
            'bail' => [
                'id' => $bail->id,
                'numero' => $bail->numero,
                'statut' => $bail->statut,
                'en_cours' => in_array($bail->statut, self::EN_COURS, true),
                'date_debut' => $bail->date_debut,
                'date_fin' => $bail->date_fin,
                'date_resiliation' => $bail->date_resiliation,
                'loyer_mensuel' => (float) $bail->loyer_mensuel,
                'charges' => (float) ($bail->charges ?? 0),
                'jour_echeance' => $bail->jour_echeance,
                'caution' => $bail->caution ? ['montant' => (float) $bail->caution->montant, 'statut' => $bail->caution->statut] : null,
                'bien' => $bail->bien ? [
                    'titre' => $bail->bien->titre,
                    'reference' => $bail->bien->reference,
                    'quartier' => $bail->bien->quartier,
                ] : null,
            ],
            'resume' => [
                'prochaine_echeance' => $prochaine,
                'total_retard' => $echeances->where('en_retard', true)->sum('reste_du'),
                'nb_retard' => $echeances->where('en_retard', true)->count(),
                'total_paye' => $echeances->sum(fn($e) => $e['montant_du'] - $e['reste_du']),
                // Toutes locations confondues : pour l'alerte globale
                'retard_global' => $liste->sum('total_retard'),
                'nb_retard_global' => $liste->sum('nb_retard'),
            ],
            'echeances' => $echeances,
            'paiements' => $paiements,
            'signalements' => $signalements,
        ]);
    }

    /** POST /mon-espace/locataire/paiements : il choisit la location ET le mois */
    public function declarerPaiement(Request $request): JsonResponse
    {
        $loc = $this->locataire($request);

        $donnees = $request->validate([
            'bail_id' => ['required', 'integer'],
            'echeance_id' => ['required', 'integer'],
            'montant' => ['required', 'numeric', 'min:100'],
            'mode_paiement' => ['required', 'string', 'max:30'],
            'reference' => ['required', 'string', 'max:100', 'unique:paiements,reference'],
            'date_paiement' => ['required', 'date', 'before_or_equal:today'],
        ], [
            'bail_id.required' => 'Choisissez la location concernée.',
            'reference.required' => 'Indiquez la référence de la transaction (reçue par SMS).',
            'reference.unique' => 'Cette référence a déjà été déclarée.',
        ]);

        $bail = $this->bailEnCours($loc, (int) $donnees['bail_id']);

        // Le mois doit appartenir à CETTE location
        $echeance = Echeance::where('id', $donnees['echeance_id'])->where('bail_id', $bail->id)->first();
        if (!$echeance) {
            throw ValidationException::withMessages(['echeance_id' => 'Ce mois ne correspond pas à la location choisie.']);
        }

        $attente = (float) Paiement::where('echeance_id', $echeance->id)->whereIn('statut', self::EN_ATTENTE)->sum('montant');
        $maximum = (float) $echeance->reste_du - $attente;

        if ($donnees['montant'] > $maximum) {
            throw ValidationException::withMessages([
                'montant' => $maximum <= 0
                    ? 'Ce mois est déjà réglé ou un paiement est en cours de vérification.'
                    : 'Montant trop élevé : il reste ' . number_format($maximum, 0, ',', ' ') . ' FCFA à payer pour ce mois.',
            ]);
        }

        unset($donnees['bail_id']);
        $paiement = new Paiement();
        $paiement->forceFill($donnees + ['statut' => 'declare']);
        if (Schema::hasColumn('paiements', 'bail_id')) {
            $paiement->bail_id = $bail->id;
        }
        $paiement->save();

        return response()->json([
            'message' => "Paiement déclaré pour {$bail->numero}. Le comptable le vérifie, puis votre quittance sera disponible ici.",
        ], 201);
    }

    /** GET /mon-espace/locataire/paiements/{paiement}/quittance : seulement SES quittances */
    public function maQuittance(Request $request, Paiement $paiement)
    {
        $loc = $this->locataire($request);
        $paiement->loadMissing('echeance.bail');

        if ($paiement->echeance?->bail?->locataire_id != $loc->id) {
            abort(403, 'Cette quittance ne vous appartient pas.');
        }

        return app(PaiementController::class)->quittance($paiement);
    }

    /** POST /mon-espace/locataire/signalements : pour la location choisie */
    public function signaler(Request $request, MaintenanceService $service): JsonResponse
    {
        $loc = $this->locataire($request);

        $donnees = $request->validate([
            'bail_id' => ['required', 'integer'],
            'titre' => ['required', 'string', 'min:3', 'max:150'],
            'description' => ['nullable', 'string', 'max:3000'],
            'categorie' => ['required', Rule::in(Signalement::CATEGORIES)],
            'urgence' => ['required', Rule::in(Signalement::URGENCES)],
        ], ['bail_id.required' => 'Choisissez le logement concerné.']);

        $bail = $this->bailEnCours($loc, (int) $donnees['bail_id']);
        unset($donnees['bail_id']);

        $s = $service->signaler($donnees + ['bien_id' => $bail->bien_id], $request->user()->id);

        return response()->json(['message' => "Signalement {$s->numero} envoyé pour {$bail->bien?->titre}. L'agence vous contacte rapidement."], 201);
    }

    // =====================================================================
    //                         ESPACE PROPRIÉTAIRE (inchangé)
    // =====================================================================

    private function proprietaire(Request $request): Proprietaire
    {
        return Proprietaire::with('user')->where('user_id', $request->user()->id)->firstOrFail();
    }

    /** GET /mon-espace/proprietaire */
    public function proprietaireTableau(Request $request): JsonResponse
    {
        $prop = $this->proprietaire($request);
        $deSesBiens = fn($q) => $q->where('proprietaire_id', $prop->id);

        $biens = Bien::with(['bailActif.locataire.user'])
            ->where('proprietaire_id', $prop->id)
            ->orderBy('reference')
            ->get()
            ->map(fn($b) => [
                'id' => $b->id,
                'reference' => $b->reference,
                'titre' => $b->titre,
                'quartier' => $b->quartier,
                'statut' => $b->statut,
                'loyer' => (float) ($b->loyer_mensuel ?? $b->loyer ?? 0),
                'locataire' => $b->bailActif?->locataire?->user
                    ? trim($b->bailActif->locataire->user->prenom . ' ' . $b->bailActif->locataire->user->nom) : null,
                'bail' => $b->bailActif ? ['numero' => $b->bailActif->numero, 'date_fin' => $b->bailActif->date_fin] : null,
            ]);

        $encaisseMois = (float) Paiement::where('statut', 'valide')
            ->whereBetween('date_paiement', [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()])
            ->whereHas('echeance.bail.bien', $deSesBiens)
            ->sum('montant');

        $impayes = Echeance::where('reste_du', '>', 0)
            ->where('date_limite', '<', now()->toDateString())
            ->whereHas('bail.bien', $deSesBiens);

        $reversements = Reversement::where('proprietaire_id', $prop->id)
            ->latest('id')->take(12)->get()
            ->map(fn($r) => $r->only(['id', 'numero', 'periode_debut', 'periode_fin', 'montant_brut', 'commission', 'montant_net', 'statut', 'date_paiement']));

        $interventions = Intervention::with('signalement.bien')
            ->where('statut', 'realisee')
            ->whereHas('signalement.bien', $deSesBiens)
            ->latest('id')->take(5)->get()
            ->map(fn($i) => [
                'date' => $i->date_realisation,
                'bien' => $i->signalement?->bien?->titre,
                'titre' => $i->signalement?->titre,
                'cout' => (float) $i->cout,
                'a_charge_de' => $i->a_charge_de,
            ]);

        return response()->json([
            'proprietaire' => $prop->user?->only(['nom', 'prenom', 'email', 'telephone']),
            'resume' => [
                'nb_biens' => $biens->count(),
                'nb_loues' => $biens->where('statut', 'loue')->count(),
                'encaisse_mois' => $encaisseMois,
                'impayes_total' => (float) (clone $impayes)->sum('reste_du'),
                'impayes_nb' => (clone $impayes)->count(),
                'a_recevoir' => (float) Reversement::where('proprietaire_id', $prop->id)->where('statut', 'a_payer')->sum('montant_net'),
            ],
            'biens' => $biens,
            'reversements' => $reversements,
            'interventions' => $interventions,
        ]);
    }

    /** GET /mon-espace/proprietaire/reversements/{reversement}/releve : seulement SES relevés */
    public function monReleve(Request $request, Reversement $reversement)
    {
        if ($reversement->proprietaire_id != $this->proprietaire($request)->id) {
            abort(403, 'Ce relevé ne vous appartient pas.');
        }

        return app(ReversementController::class)->releve($reversement);
    }
}