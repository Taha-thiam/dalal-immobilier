export type StatutBail = 'actif' | 'resilie' | 'termine';
export type TypeBail = 'habitation' | 'professionnel';
export type StatutEcheance = 'impayee' | 'partielle' | 'payee';

export const STATUTS_BAIL: Record<StatutBail, string> = {
    actif: 'Actif',
    resilie: 'Résilié',
    termine: 'Terminé',
};

export const STATUTS_ECHEANCE: Record<StatutEcheance, string> = {
    impayee: 'Impayée',
    partielle: 'Partiellement payée',
    payee: 'Payée',
};

/** Un bail dans la liste */
export interface Bail {
    id: number;
    numero: string;
    statut: StatutBail;
    type_bail: TypeBail;
    date_debut: string;
    date_fin: string;
    loyer_mensuel: string;
    charges: string;
    bien: { id: number; reference: string; titre: string; quartier: string } | null;
    locataire: { id: number; nom: string; prenom: string; telephone: string | null } | null;
    proprietaire: { nom: string; prenom: string } | null;
    created_at: string;
}

/** Une échéance de loyer (un mois) */
export interface Echeance {
    id: number;
    mois: string;          // "2026-12-01"
    montant_du: string;
    reste_du: string;
    date_limite: string;   // "2026-12-05"
    statut: StatutEcheance;
}

/** Le détail complet d'un bail */
export interface BailDetail extends Bail {
    avance: string;
    jour_echeance: number;
    renouvellement_tacite: boolean;
    preavis_mois: number;
    clauses: string | null;
    gestionnaire: string | null;
    caution: { montant: string; statut: 'a_encaisser' | 'encaissee' | 'remboursee'; date_encaissement: string | null } | null;
    echeances: Echeance[];
    contrats: { id: number; version: number; date_ajout: string | null }[];
}

/** Champs envoyés pour créer un bail */
export interface BailSaisie {
    bien_id: number;
    locataire_id: number;
    type_bail: TypeBail;
    date_debut: string;     // format "AAAA-MM-JJ"
    duree_mois: number;
    loyer_mensuel: number;
    charges: number | null;
    caution: number | null;
    avance: number | null;
    jour_echeance: number;
    renouvellement_tacite: boolean;
    preavis_mois: number;
    clauses: string | null;
}

export interface ReponseBail {
    message: string;
    bail: Bail;
}