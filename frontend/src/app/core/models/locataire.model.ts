/** Un locataire tel que l'API le renvoie (compte + fiche à plat). */
export interface Locataire {
    id: number;
    user_id: number;
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    statut: 'actif' | 'desactive';
    numero_cni: string | null;
    profession: string | null;
    baux_count: number;          // tous ses baux, depuis toujours
    baux_actifs_count: number;   // ses baux en cours
    created_at: string;
}

/** Un bail dans l'historique d'un locataire */
export interface BailHistorique {
    id: number;
    numero: string;
    statut: 'actif' | 'resilie' | 'termine';
    date_debut: string;
    date_fin: string;
    loyer_mensuel: string;
    bien: { id: number; reference: string; titre: string; quartier: string } | null;
}

/** Le détail d'un locataire : en plus, l'historique de ses baux */
export interface LocataireDetail extends Locataire {
    baux: BailHistorique[];
}

/** Les champs envoyés à l'API pour créer ou modifier un locataire. */
export interface LocataireSaisie {
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    numero_cni: string | null;
    profession: string | null;
}

/** Réponse de l'API après une création. */
export interface CreationLocataireReponse {
    message: string;
    locataire: Locataire;
    mot_de_passe_temporaire: string;
}

/** Réponse de l'API après une modification. */
export interface ModificationLocataireReponse {
    message: string;
    locataire: Locataire;
}