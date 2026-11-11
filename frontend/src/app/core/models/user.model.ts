// Les rôles possibles (identiques à ceux de la base de données Laravel)
export type Role =
  | 'administrateur'
  | 'gestionnaire'
  | 'comptable'
  | 'proprietaire'
  | 'locataire';

// L'utilisateur tel que l'API le renvoie (/login et /me)
export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  role: Role;
}

// La réponse de l'API après une connexion réussie
export interface LoginResponse {
  token: string;
  user: User;
}

// Libellés affichés à l'écran pour chaque rôle
export const ROLE_LIBELLES: Record<Role, string> = {
  administrateur: 'Administrateur',
  gestionnaire: 'Gestionnaire',
  comptable: 'Comptable',
  proprietaire: 'Propriétaire',
  locataire: 'Locataire',
};