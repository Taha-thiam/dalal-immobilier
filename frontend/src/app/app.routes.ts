import { Routes } from '@angular/router';
import { authGuard, invitesGuard, roleGuard } from './core/guards/auth.guard';

// Chargement « à la demande » : une page n'est téléchargée que lorsqu'on l'ouvre
const tableauDeBord = () => import('./pages/tableau-de-bord/tableau-de-bord').then((m) => m.TableauDeBord);
const administration = () => import('./pages/admin/administration').then((m) => m.Administration);

// Rôles autorisés (à placer directement dans data: ...)
const ADMIN = { roles: ['administrateur'] };
const GESTION = { roles: ['gestionnaire', 'administrateur'] };
const COMPTA = { roles: ['comptable', 'administrateur'] };

export const routes: Routes = [
    // ===================== PORTAIL PUBLIC (sans connexion) =====================
    {
        path: '',
        pathMatch: 'full',
        title: 'Dalal Immobilier — Ici, vous êtes chez vous',
        loadComponent: () => import('./pages/public/vitrine').then((m) => m.Vitrine),
    },
    {
        path: 'annonces/:id',
        title: 'Annonce — Dalal Immobilier',
        loadComponent: () => import('./pages/public/annonce').then((m) => m.AnnoncePage),
    },
    {
        path: 'connexion',
        canActivate: [invitesGuard],
        title: 'Connexion — Dalal Immobilier',
        loadComponent: () => import('./pages/connexion/connexion').then((m) => m.Connexion),
    },
    {
        path: 'mot-de-passe-oublie',
        canActivate: [invitesGuard],
        title: 'Mot de passe oublié — Dalal Immobilier',
        loadComponent: () => import('./pages/connexion/mot-de-passe-oublie').then((m) => m.MotDePasseOublie),
    },

    // ===================== ESPACE CONNECTÉ (cadre menu + contenu) =====================
    {
        path: '',
        canActivate: [authGuard],
        loadComponent: () => import('./layout/layout').then((m) => m.Layout),
        children: [
            // ----- Tableaux de bord du personnel -----
            { path: 'admin', canActivate: [roleGuard], data: ADMIN, loadComponent: tableauDeBord },
            { path: 'gestion', canActivate: [roleGuard], data: { roles: ['gestionnaire'] }, loadComponent: tableauDeBord },
            { path: 'comptabilite', canActivate: [roleGuard], data: { roles: ['comptable'] }, loadComponent: tableauDeBord },

            // ----- Administration -----
            { path: 'admin/comptes', canActivate: [roleGuard], data: { ...ADMIN, onglet: 'personnel' }, loadComponent: administration },
            { path: 'admin/parametres', canActivate: [roleGuard], data: { ...ADMIN, onglet: 'parametres' }, loadComponent: administration },
            { path: 'admin/journal', canActivate: [roleGuard], data: { ...ADMIN, onglet: 'journal' }, loadComponent: administration },

            // ----- Pour tous les utilisateurs connectés -----
            {
                path: 'mon-mot-de-passe',
                title: 'Mon mot de passe — Dalal Immobilier',
                loadComponent: () => import('./pages/compte/mon-mot-de-passe').then((m) => m.MonMotDePasse),
            },
            {
                path: 'admin/mots-de-passe',
                canActivate: [roleGuard], data: ADMIN,
                loadComponent: () => import('./pages/admin/mots-de-passe').then((m) => m.MotsDePasse),
            },
            // ----- Gestion du patrimoine -----
            {
                path: 'gestion/proprietaires',
                canActivate: [roleGuard], data: GESTION,
                loadComponent: () => import('./pages/proprietaires/proprietaires').then((m) => m.Proprietaires),
            },
            {
                path: 'gestion/biens',
                canActivate: [roleGuard], data: GESTION,
                loadComponent: () => import('./pages/biens/biens').then((m) => m.Biens),
            },
            {
                path: 'gestion/biens/:id',
                canActivate: [roleGuard], data: GESTION,
                loadComponent: () => import('./pages/biens/bien-detail').then((m) => m.BienDetailPage),
            },
            {
                path: 'gestion/locataires',
                canActivate: [roleGuard], data: GESTION,
                loadComponent: () => import('./pages/locataires/locataires').then((m) => m.Locataires),
            },
            {
                path: 'gestion/baux',
                canActivate: [roleGuard], data: GESTION,
                loadComponent: () => import('./pages/baux/baux').then((m) => m.Baux),
            },
            {
                path: 'gestion/baux/:id',
                canActivate: [roleGuard], data: GESTION,
                loadComponent: () => import('./pages/baux/bail-detail').then((m) => m.BailDetailPage),
            },
            {
                path: 'gestion/etats-des-lieux/:id',
                canActivate: [roleGuard], data: GESTION,
                loadComponent: () => import('./pages/baux/etat-des-lieux').then((m) => m.EtatDesLieuxPage),
            },
            {
                path: 'gestion/demandes',
                canActivate: [roleGuard], data: GESTION,
                loadComponent: () => import('./pages/demandes/demandes').then((m) => m.Demandes),
            },
            {
                path: 'gestion/maintenance',
                canActivate: [roleGuard], data: GESTION,
                loadComponent: () => import('./pages/maintenance/maintenance').then((m) => m.Maintenance),
            },

            // ----- Comptabilité -----
            {
                path: 'comptabilite/paiements',
                canActivate: [roleGuard], data: COMPTA,
                loadComponent: () => import('./pages/paiements/paiements').then((m) => m.Paiements),
            },
            {
                path: 'comptabilite/impayes',
                canActivate: [roleGuard], data: COMPTA,
                loadComponent: () => import('./pages/paiements/impayes').then((m) => m.Impayes),
            },
            {
                path: 'comptabilite/cautions',
                canActivate: [roleGuard], data: COMPTA,
                loadComponent: () => import('./pages/cautions/cautions').then((m) => m.Cautions),
            },
            {
                path: 'comptabilite/reversements',
                canActivate: [roleGuard], data: COMPTA,
                loadComponent: () => import('./pages/reversements/reversements').then((m) => m.Reversements),
            },

            // ----- Espaces clients -----
            {
                path: 'proprietaire',
                canActivate: [roleGuard], data: { roles: ['proprietaire'] },
                loadComponent: () => import('./pages/espaces/espace-proprietaire').then((m) => m.EspaceProprietaire),
            },
            {
                path: 'locataire',
                canActivate: [roleGuard], data: { roles: ['locataire'] },
                loadComponent: () => import('./pages/espaces/espace-locataire').then((m) => m.EspaceLocataire),
            },
        ],
    },

    // Adresse inconnue → retour à la vitrine
    { path: '**', redirectTo: '' },
];