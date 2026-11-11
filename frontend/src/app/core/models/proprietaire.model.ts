/** Un propriétaire tel que l'API le renvoie (compte + fiche à plat). */
export interface Proprietaire {
    id: number;
    user_id: number;
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    statut: 'actif' | 'desactive';
    adresse: string | null;
    numero_cni: string | null;
    rib_reversement: string | null;
    biens_count: number;
    created_at: string;
}

/** Les champs envoyés à l'API pour créer ou modifier un propriétaire. */
export interface ProprietaireSaisie {
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    adresse: string | null;
    numero_cni: string | null;
    rib_reversement: string | null;
}

/** Réponse de l'API après une création. */
export interface CreationProprietaireReponse {
    message: string;
    proprietaire: Proprietaire;
    mot_de_passe_temporaire: string;
}

/** Réponse de l'API après une modification. */
export interface ModificationProprietaireReponse {
    message: string;
    proprietaire: Proprietaire;
}