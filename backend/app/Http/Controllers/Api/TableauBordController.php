<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bail;
use App\Models\Bien;
use App\Models\Caution;
use App\Models\DemandeLocation;
use App\Models\Echeance;
use App\Models\Paiement;
use App\Models\Reversement;
use App\Models\Signalement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TableauBordController extends Controller
{
    /** GET /tableau-de-bord : les données s'adaptent au rôle connecté */
    public function index(Request $request): JsonResponse
    {
        $role = $request->user()->role;
        $voitGestion = in_array($role, ['gestionnaire', 'administrateur'], true);
        $voitCompta = in_array($role, ['comptable', 'administrateur'], true);

        $reponse = ['role' => $role, 'genere_le' => now()->toDateTimeString()];

        if ($voitGestion) {
            $reponse['gestion'] = $this->gestion();
        }
        if ($voitCompta) {
            $reponse['compta'] = $this->compta();
        }

        return response()->json($reponse);
    }

    // =====================================================================
    // GESTION
    // =====================================================================
    private function gestion(): array
    {
        $parStatut = Bien::select('statut', DB::raw('COUNT(*) as total'))
            ->groupBy('statut')->pluck('total', 'statut');

        $total = (int) $parStatut->sum();
        $loues = (int) ($parStatut['loue'] ?? 0);
        $horsArchive = $total - (int) ($parStatut['archive'] ?? 0);

        $expirent = Bail::with(['bien', 'locataire.user'])
            ->where('statut', 'actif')
            ->whereBetween('date_fin', [now()->toDateString(), now()->addDays(60)->toDateString()])
            ->orderBy('date_fin')->take(5)->get()
            ->map(fn($b) => [
                'id' => $b->id,
                'numero' => $b->numero,
                'bien' => $b->bien?->titre,
                'locataire' => trim(($b->locataire?->user?->prenom ?? '') . ' ' . ($b->locataire?->user?->nom ?? '')),
                'date_fin' => $b->date_fin,
                'jours' => now()->startOfDay()->diffInDays(Carbon::parse($b->date_fin), false),
            ]);

        $signalementsParCategorie = Signalement::whereIn('statut', ['nouveau', 'en_cours'])
            ->select('categorie', DB::raw('COUNT(*) as total'))
            ->groupBy('categorie')->pluck('total', 'categorie');

        return [
            'kpi' => [
                'biens_total' => $total,
                'biens_loues' => $loues,
                'biens_libres' => (int) ($parStatut['libre'] ?? 0),
                'taux_occupation' => $horsArchive > 0 ? round($loues / $horsArchive * 100) : 0,
                'baux_actifs' => Bail::whereIn('statut', ['actif', 'en_preavis'])->count(),
                'baux_en_preavis' => Bail::where('statut', 'en_preavis')->count(),
                'demandes_nouvelles' => DemandeLocation::where('statut', 'nouvelle')->count(),
                'signalements_ouverts' => Signalement::whereIn('statut', ['nouveau', 'en_cours'])->count(),
                'signalements_urgents' => Signalement::whereIn('statut', ['nouveau', 'en_cours'])->where('urgence', 'haute')->count(),
            ],
            'biens_par_statut' => $parStatut,
            'signalements_par_categorie' => $signalementsParCategorie,
            'baux_qui_expirent' => $expirent,
        ];
    }

    // =====================================================================
    // COMPTABILITÉ
    // =====================================================================
    private function compta(): array
    {
        $debutMois = now()->startOfMonth()->toDateString();
        $finMois = now()->endOfMonth()->toDateString();
        $aujourdhui = now()->toDateString();

        // ---- 12 derniers mois : attendu (échéances) vs encaissé (paiements validés) ----
        $debut12 = now()->startOfMonth()->subMonths(11);
        $mois = collect(range(0, 11))->map(fn($i) => $debut12->copy()->addMonths($i)->format('Y-m'));

        $encaisse = Paiement::where('statut', 'valide')
            ->where('date_paiement', '>=', $debut12->toDateString())
            ->select(DB::raw("to_char(date_paiement, 'YYYY-MM') as m"), DB::raw('SUM(montant) as total'))
            ->groupBy('m')->pluck('total', 'm');

        $attendu = Echeance::where('mois', '>=', $debut12->toDateString())
            ->where('mois', '<=', now()->endOfMonth()->toDateString())
            ->select(DB::raw("to_char(mois, 'YYYY-MM') as m"), DB::raw('SUM(montant_du) as total'))
            ->groupBy('m')->pluck('total', 'm');

        $courbe = $mois->map(fn($m) => [
            'mois' => $m,
            'attendu' => (float) ($attendu[$m] ?? 0),
            'encaisse' => (float) ($encaisse[$m] ?? 0),
        ])->values();

        // ---- Indicateurs ----
        $attenduMois = (float) Echeance::whereBetween('mois', [$debutMois, $finMois])->sum('montant_du');
        $encaisseMois = (float) Paiement::where('statut', 'valide')->whereBetween('date_paiement', [$debutMois, $finMois])->sum('montant');

        $retards = Echeance::where('reste_du', '>', 0)->where('date_limite', '<', $aujourdhui);

        $pireRetards = (clone $retards)->with(['bail.locataire.user', 'bail.bien'])
            ->orderBy('date_limite')->take(5)->get()
            ->map(fn($e) => [
                'locataire' => trim(($e->bail?->locataire?->user?->prenom ?? '') . ' ' . ($e->bail?->locataire?->user?->nom ?? '')),
                'telephone' => $e->bail?->locataire?->user?->telephone,
                'bien' => $e->bail?->bien?->titre,
                'mois' => $e->mois,
                'reste_du' => (float) $e->reste_du,
                'jours' => Carbon::parse($e->date_limite)->diffInDays(now()->startOfDay()),
            ]);

        $derniers = Paiement::with(['echeance.bail.locataire.user'])
            ->where('statut', 'valide')->latest('id')->take(5)->get()
            ->map(fn($p) => [
                'locataire' => trim(($p->echeance?->bail?->locataire?->user?->prenom ?? '') . ' ' . ($p->echeance?->bail?->locataire?->user?->nom ?? '')),
                'montant' => (float) $p->montant,
                'mode' => $p->mode_paiement,
                'date' => $p->date_paiement,
            ]);

        return [
            'kpi' => [
                'attendu_mois' => $attenduMois,
                'encaisse_mois' => $encaisseMois,
                'taux_recouvrement' => $attenduMois > 0 ? round($encaisseMois / $attenduMois * 100) : 0,
                'impayes_total' => (float) (clone $retards)->sum('reste_du'),
                'impayes_nb' => (clone $retards)->count(),
                'a_valider' => Paiement::whereIn('statut', ['declare', 'enregistre'])->count(),
                'cautions_a_encaisser' => Caution::where('statut', 'a_encaisser')->count(),
                'cautions_detenues' => (float) Caution::where('statut', 'encaissee')->sum('montant'),
                'reversements_a_payer' => (float) Reversement::where('statut', 'a_payer')->sum('montant_net'),
                'commissions_mois' => (float) Reversement::whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])->sum('commission'),
            ],
            'courbe_12_mois' => $courbe,
            'pires_retards' => $pireRetards,
            'derniers_paiements' => $derniers,
        ];
    }
}