export type TypeBien = 'appartement' | 'villa' | 'studio' | 'chambre' | 'bureau' | 'magasin';
export type StatutBien = 'libre' | 'loue' | 'archive';

/** Libellés affichés à l'écran */
export const TYPES_BIEN: { valeur: TypeBien; libelle: string }[] = [
    { valeur: 'appartement', libelle: 'Appartement' },
    { valeur: 'villa', libelle: 'Villa' },
    { valeur: 'studio', libelle: 'Studio' },
    { valeur: 'chambre', libelle: 'Chambre' },
    { valeur: 'bureau', libelle: 'Bureau' },
    { valeur: 'magasin', libelle: 'Magasin' },
];

export const STATUTS_BIEN: Record<StatutBien, string> = {
    libre: 'Libre',
    loue: 'Loué',
    archive: 'Archivé',
};

/** Une photo d'un bien */
export interface PhotoBien {
    id: number;
    url: string;
    ordre: number;
}

/** Un bien tel que l'API le renvoie dans la liste */
export interface Bien {
    id: number;
    reference: string;
    type: TypeBien;
    titre: string;
    quartier: string;
    adresse: string;
    surface: string | null;          // Laravel renvoie les décimaux en texte : "95.00"
    nb_pieces: number | null;
    loyer_propose: string;
    caution: string;
    description: string | null;
    taux_commission: string;
    statut: StatutBien;
    publie: boolean;
    proprietaire: { id: number; nom: string; prenom: string } | null;
    photo_principale: string | null;
    photos_count: number;
    created_at: string;
}

/** Le détail d'un bien : en plus, toutes ses photos et son bail en cours */
export interface BienDetail extends Bien {
    photos: PhotoBien[];
    bail_actif: {
        id: number;
        numero: string;
        date_debut: string;
        date_fin: string;
        loyer_mensuel: string;
        locataire: string | null;
    } | null;
}

/** Champs envoyés pour créer ou modifier un bien */
export interface BienSaisie {
    proprietaire_id: number;
    type: TypeBien;
    titre: string;
    quartier: string;
    adresse: string;
    surface: number | null;
    nb_pieces: number | null;
    loyer_propose: number;
    caution: number | null;
    description: string | null;
    taux_commission: number | null;
}

/** Filtres de la liste */
export interface FiltresBien {
    recherche?: string;
    statut?: StatutBien | '';
    type?: TypeBien | '';
    proprietaire_id?: number | null;
}

/** Réponses de l'API */
export interface ReponseBien {
    message: string;
    bien: Bien;
}

export interface ReponsePhotos {
    message: string;
    photos: PhotoBien[];
}