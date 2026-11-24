<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BailController;
use App\Http\Controllers\Api\BienController;
use App\Http\Controllers\Api\CautionController;
use App\Http\Controllers\Api\DemandeController;
use App\Http\Controllers\Api\EspaceController;
use App\Http\Controllers\Api\FinBailController;
use App\Http\Controllers\Api\LocataireController;
use App\Http\Controllers\Api\MaintenanceController;
use App\Http\Controllers\Api\PaiementController;
use App\Http\Controllers\Api\PhotoBienController;
use App\Http\Controllers\Api\PortailController;
use App\Http\Controllers\Api\ProprietaireController;
use App\Http\Controllers\Api\ReversementController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\TableauBordController;

/*
|--------------------------------------------------------------------------
| Routes publiques
|--------------------------------------------------------------------------
*/
// 5 tentatives de connexion par minute maximum (protection contre le forçage de mot de passe)
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
// Mot de passe oublié : 3 demandes par minute maximum
Route::post('/mot-de-passe-oublie', [AuthController::class, 'motDePasseOublie'])->middleware('throttle:3,1');

// ===================== PORTAIL PUBLIC (sans connexion) =====================
Route::prefix('public')->group(function () {
    // Consultation : 60 requêtes par minute
    Route::middleware('throttle:60,1')->group(function () {
        Route::get('annonces', [PortailController::class, 'annonces']);
        Route::get('annonces/{id}', [PortailController::class, 'annonce'])->whereNumber('id');
        Route::get('filtres', [PortailController::class, 'filtres']);
        Route::get('agence', [PortailController::class, 'agence']);
    });

    // Envois : 5 par minute maximum (anti-spam)
    Route::middleware('throttle:5,1')->group(function () {
        Route::post('annonces/{id}/demandes', [PortailController::class, 'demander'])->whereNumber('id');
        Route::post('contact', [PortailController::class, 'contacter']);
    });
});

/*
|--------------------------------------------------------------------------
| Routes protégées (jeton Sanctum obligatoire)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

    // Compte connecté
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    // Chaque utilisateur change son propre mot de passe
    Route::put('/mot-de-passe', [AuthController::class, 'changerMotDePasse']);

    // Tableau de bord : le contenu s'adapte au rôle connecté
    Route::get('/tableau-de-bord', [TableauBordController::class, 'index'])
        ->middleware('role:administrateur,gestionnaire,comptable');

    // ===================== ADMINISTRATION : administrateur seul =====================
    Route::middleware('role:administrateur')->prefix('admin')->group(function () {
        // Personnel
        Route::get('personnel', [AdminController::class, 'personnel']);
        Route::post('personnel', [AdminController::class, 'creerCompte']);
        Route::patch('personnel/{user}/statut', [AdminController::class, 'basculerStatut']);
        Route::post('personnel/{user}/mot-de-passe', [AdminController::class, 'reinitialiserMotDePasse']);

        // Mots de passe : tous les comptes + demandes « mot de passe oublié »
        Route::get('utilisateurs', [AdminController::class, 'utilisateurs']);
        Route::post('utilisateurs/{user}/mot-de-passe', [AdminController::class, 'reinitialiserMotDePasse']);
        Route::patch('utilisateurs/{user}/statut', [AdminController::class, 'basculerStatut']);
        Route::get('demandes-mot-de-passe', [AdminController::class, 'demandesMotDePasse']);
        Route::get('demandes-mot-de-passe/compteur', [AdminController::class, 'compteurDemandesMotDePasse']);
        Route::patch('demandes-mot-de-passe/{demande}/rejet', [AdminController::class, 'rejeterDemande']);
        // Paramètres de l'agence
        Route::get('parametres', [AdminController::class, 'parametres']);
        Route::put('parametres', [AdminController::class, 'enregistrerParametres']);

        // Journal d'activité
        Route::get('journal', [AdminController::class, 'journal']);
    });

    // ===================== GESTION : gestionnaire et administrateur =====================
    Route::middleware('role:gestionnaire,administrateur')->group(function () {

        // Propriétaires et locataires
        Route::apiResource('proprietaires', ProprietaireController::class);
        Route::apiResource('locataires', LocataireController::class);

        // Biens
        Route::apiResource('biens', BienController::class);
        Route::patch('biens/{bien}/publication', [BienController::class, 'publication']);
        Route::patch('biens/{bien}/archivage', [BienController::class, 'archivage']);

        // Photos d'un bien
        Route::post('biens/{bien}/photos', [PhotoBienController::class, 'store']);
        Route::patch('biens/{bien}/photos/{photo}/principale', [PhotoBienController::class, 'principale']);
        Route::delete('biens/{bien}/photos/{photo}', [PhotoBienController::class, 'destroy']);

        // Baux (le paramètre s'appelle {bail}, et non {baux})
        Route::apiResource('baux', BailController::class)
            ->only(['index', 'store', 'show'])
            ->parameters(['baux' => 'bail']);
        Route::get('baux/{bail}/contrat', [BailController::class, 'contrat']);
        Route::post('baux/{bail}/contrat', [BailController::class, 'regenererContrat']);

        // Fin de bail
        Route::post('baux/{bail}/resiliation', [FinBailController::class, 'resilier']);
        Route::post('baux/{bail}/etat-des-lieux-sortie', [FinBailController::class, 'ouvrirEdlSortie']);
        Route::post('baux/{bail}/cloture', [FinBailController::class, 'cloturer']);
        Route::post('baux/{bail}/renouvellement', [FinBailController::class, 'renouveler']);

        // États des lieux
        Route::get('etats-des-lieux/{etatDesLieux}', [FinBailController::class, 'afficherEdl']);
        Route::put('etats-des-lieux/{etatDesLieux}', [FinBailController::class, 'enregistrerEdl']);
        Route::patch('etats-des-lieux/{etatDesLieux}/validation', [FinBailController::class, 'validerEdl']);

        // Maintenance : signalements et interventions
        Route::get('signalements', [MaintenanceController::class, 'index']);
        Route::post('signalements', [MaintenanceController::class, 'store']);
        Route::get('signalements/{signalement}', [MaintenanceController::class, 'show']);
        Route::post('signalements/{signalement}/interventions', [MaintenanceController::class, 'planifier']);
        Route::patch('signalements/{signalement}/resolution', [MaintenanceController::class, 'resoudre']);
        Route::patch('signalements/{signalement}/rejet', [MaintenanceController::class, 'rejeter']);
        Route::patch('interventions/{intervention}/realisation', [MaintenanceController::class, 'realiser']);
        Route::patch('interventions/{intervention}/annulation', [MaintenanceController::class, 'annulerIntervention']);

        // Demandes de location et messages de contact
        Route::get('demandes', [DemandeController::class, 'index']);
        Route::get('demandes/compteur', [DemandeController::class, 'compteur']);
        Route::patch('demandes/{demande}/visite', [DemandeController::class, 'planifierVisite']);
        Route::patch('demandes/{demande}/acceptation', [DemandeController::class, 'accepter']);
        Route::patch('demandes/{demande}/refus', [DemandeController::class, 'refuser']);
        Route::get('messages-contact', [DemandeController::class, 'messages']);
        Route::patch('messages-contact/{message}/lu', [DemandeController::class, 'marquerLu']);
    });

    // ===================== COMPTABILITÉ : comptable et administrateur =====================
    Route::middleware('role:comptable,administrateur')->group(function () {

        // Ce qu'il reste à encaisser
        Route::get('echeances', [PaiementController::class, 'echeances']);

        // Paiements
        Route::get('paiements', [PaiementController::class, 'index']);
        Route::post('paiements', [PaiementController::class, 'store']);
        Route::patch('paiements/{paiement}/valider', [PaiementController::class, 'valider']);
        Route::patch('paiements/{paiement}/annuler', [PaiementController::class, 'annuler']);

        // Quittances
        Route::get('paiements/{paiement}/quittance', [PaiementController::class, 'quittance']);
        Route::post('paiements/{paiement}/quittance', [PaiementController::class, 'regenererQuittance']);

        // Cautions
        Route::get('cautions', [CautionController::class, 'index']);
        Route::patch('cautions/{caution}/encaisser', [CautionController::class, 'encaisser']);
        Route::patch('cautions/{caution}/restituer', [CautionController::class, 'restituer']);

        // Reversements aux propriétaires
        Route::get('reversements/apercu', [ReversementController::class, 'apercu']);   // AVANT les routes {reversement}
        Route::get('reversements', [ReversementController::class, 'index']);
        Route::post('reversements', [ReversementController::class, 'store']);
        Route::patch('reversements/{reversement}/payer', [ReversementController::class, 'payer']);
        Route::delete('reversements/{reversement}', [ReversementController::class, 'destroy']);
        Route::get('reversements/{reversement}/releve', [ReversementController::class, 'releve']);
        Route::post('reversements/{reversement}/releve', [ReversementController::class, 'regenererReleve']);
    });

    // ===================== ESPACE LOCATAIRE : locataire seul =====================
    Route::middleware('role:locataire')->prefix('mon-espace/locataire')->group(function () {
        Route::get('/', [EspaceController::class, 'locataireTableau']);
        Route::post('paiements', [EspaceController::class, 'declarerPaiement']);
        Route::get('paiements/{paiement}/quittance', [EspaceController::class, 'maQuittance']);
        Route::post('signalements', [EspaceController::class, 'signaler']);
    });

    // ===================== ESPACE PROPRIÉTAIRE : propriétaire seul =====================
    Route::middleware('role:proprietaire')->prefix('mon-espace/proprietaire')->group(function () {
        Route::get('/', [EspaceController::class, 'proprietaireTableau']);
        Route::get('reversements/{reversement}/releve', [EspaceController::class, 'monReleve']);
    });
});