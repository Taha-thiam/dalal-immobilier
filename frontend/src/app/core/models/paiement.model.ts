export type ModePaiement = 'especes' | 'wave' | 'orange_money' | 'virement';
export type StatutPaiement = 'declare' | 'enregistre' | 'valide' | 'annule';

export const MODES_PAIEMENT: { valeur: ModePaiement; libelle: string }[] = [
    { valeur: 'especes', libelle: 'Espèces' },
    { valeur: 'wave', libelle: 'Wave' },
    { valeur: 'orange_money', libelle: 'Orange Money' },
    { valeur: 'virement', libelle: 'Virement bancaire' },
];

export const STATUTS_PAIEMENT: Record<StatutPaiement, string> = {
    declare: 'Déclaré par le locataire',
    enregistre: 'À valider',
    valide: 'Validé',
    annule: 'Annulé',
};

/** Une échéance non soldée (ce qu'il reste à encaisser) */
export interface EcheanceAEncaisser {
    id: number;
    mois: string;            // "2026-12-01"
    montant_du: string;
    reste_du: string;
    en_attente: string;      // paiements enregistrés mais pas encore validés
    date_limite: string;
    statut: 'impayee' | 'partielle';
    en_retard: boolean;
    bail: { id: number; numero: string } | null;
    bien: { id: number; titre: string; quartier: string } | null;
    locataire: { nom: string; prenom: string; telephone: string | null } | null;
}

/** Un paiement */
export interface Paiement {
    id: number;
    montant: string;
    date_paiement: string;
    mode_paiement: ModePaiement;
    reference: string | null;
    statut: StatutPaiement;
    motif_annulation: string | null;
    comptable: string | null;
    quittance: { numero: string } | null;
    echeance: { id: number; mois: string; statut: string; reste_du: string } | null;
    bail: { id: number; numero: string } | null;
    bien: { titre: string } | null;
    locataire: { nom: string; prenom: string } | null;
    created_at: string;
}

/** Champs envoyés pour enregistrer un paiement */
export interface PaiementSaisie {
    echeance_id: number;
    montant: number;
    date_paiement: string;   // "AAAA-MM-JJ"
    mode_paiement: ModePaiement;
    reference: string | null;
}

export interface ReponsePaiement {
    message: string;
    paiement: Paiement;
}