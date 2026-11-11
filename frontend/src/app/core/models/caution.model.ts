export type StatutCaution = 'a_encaisser' | 'encaissee' | 'restituee';

export interface Caution {
    id: number;
    bail_id: number;
    montant: string;
    statut: StatutCaution;

    date_encaissement: string | null;
    mode_encaissement: string | null;
    reference_encaissement: string | null;

    montant_retenu: string;
    motif_retenue: string | null;
    montant_rembourse: string | null;
    date_remboursement: string | null;
    mode_remboursement: string | null;

    bail: { id: number; numero: string; date_debut: string; date_fin: string; statut: string } | null;
    bien: { id: number; titre: string; reference: string } | null;
    locataire: { nom: string; prenom: string; telephone: string | null } | null;
}

export interface EncaissementCaution {
    date: string;
    mode: string;
    reference?: string | null;
}

export interface RestitutionCaution {
    date: string;
    mode: string;
    montant_retenu?: number;
    motif_retenue?: string | null;
}

/** Libellé + couleurs néon de chaque statut. */
export const STATUTS_CAUTION: Record<StatutCaution, { libelle: string; classe: string }> = {
    a_encaisser: { libelle: 'À encaisser', classe: 'border-amber-300/60 bg-amber-300/10 text-amber-300' },
    encaissee: { libelle: 'Encaissée', classe: 'border-neon-bleu/60 bg-neon-bleu/10 text-neon-bleu' },
    restituee: { libelle: 'Restituée', classe: 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' },
};