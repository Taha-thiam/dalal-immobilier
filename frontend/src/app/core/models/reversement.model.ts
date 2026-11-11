export type StatutReversement = 'a_payer' | 'paye';

/** Une ligne de l'aperçu : ce que l'agence doit à un propriétaire. */
export interface LigneApercu {
    proprietaire_id: number;
    nom: string;
    prenom: string;
    telephone: string | null;
    nb_paiements: number;
    montant_brut: number;
    commission: number;
    montant_net: number;
}

export interface Apercu {
    jusquau: string;
    lignes: LigneApercu[];
    total_brut: number;
    total_com: number;
    total_net: number;
}

export interface Reversement {
    id: number;
    numero: string;
    proprietaire_id: number;
    periode_debut: string;
    periode_fin: string;
    montant_brut: string;
    commission: string;
    montant_net: string;
    statut: StatutReversement;
    date_paiement: string | null;
    mode_paiement: string | null;
    reference: string | null;
    paiements_count: number;
    created_at: string;
    proprietaire: { id: number; nom: string; prenom: string; telephone: string | null } | null;
}

export interface PaiementReversement {
    date: string;
    mode: string;
    reference?: string | null;
}

export const STATUTS_REVERSEMENT: Record<StatutReversement, { libelle: string; classe: string }> = {
    a_payer: { libelle: 'À payer', classe: 'border-amber-300/60 bg-amber-300/10 text-amber-300' },
    paye: { libelle: 'Payé', classe: 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' },
};