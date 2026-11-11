import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type EtatElement = 'bon' | 'moyen' | 'mauvais';
export type Initiative = 'locataire' | 'proprietaire' | 'agence';

export interface ElementEdl {
  id?: number;
  piece: string;
  element: string;
  etat: EtatElement;
  commentaire: string | null;
  montant_retenue: number | string;
}

export interface EtatDesLieux {
  id: number;
  bail_id: number;
  type: 'entree' | 'sortie';
  date_edl: string;
  statut: 'brouillon' | 'valide';
  observations: string | null;
  index_eau: string | null;
  index_electricite: string | null;
  nb_cles: number | null;
  total_retenues: string;
  elements: ElementEdl[];
  bail: {
    id: number;
    numero: string;
    statut: string;
    date_resiliation: string | null;
    bien: string | null;
    locataire: string | null;
  } | null;
}

export interface Resiliation {
  date_effet: string;
  motif: string;
  initiative: Initiative;
}

export interface EnregistrementEdl {
  date_edl: string;
  observations: string | null;
  index_eau: string | null;
  index_electricite: string | null;
  nb_cles: number | null;
  elements: ElementEdl[];
}

export const ETATS_ELEMENT: { valeur: EtatElement; libelle: string; classe: string }[] = [
  { valeur: 'bon', libelle: 'Bon', classe: 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' },
  { valeur: 'moyen', libelle: 'Moyen', classe: 'border-amber-300/60 bg-amber-300/10 text-amber-300' },
  { valeur: 'mauvais', libelle: 'Mauvais', classe: 'border-neon-rouge/60 bg-neon-rouge/10 text-neon-rouge' },
];

export const INITIATIVES: { valeur: Initiative; libelle: string }[] = [
  { valeur: 'locataire', libelle: 'Le locataire (congé)' },
  { valeur: 'proprietaire', libelle: 'Le propriétaire (reprise)' },
  { valeur: 'agence', libelle: "L'agence (manquement au contrat)" },
];

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class FinBailService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  renouveler(bailId: number, donnees: { duree_mois: number; loyer_mensuel: number | null; charges: number | null }): Observable<{ message: string; bail_id: number }> {
    return this.http.post<{ message: string; bail_id: number }>(`${this.api}/baux/${bailId}/renouvellement`, donnees);
  }

  resilier(bailId: number, donnees: Resiliation): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/baux/${bailId}/resiliation`, donnees);
  }

  /** Ouvre (ou reprend) le brouillon d'état des lieux de sortie. */
  ouvrirEdlSortie(bailId: number): Observable<EtatDesLieux> {
    return this.http.post<EtatDesLieux>(`${this.api}/baux/${bailId}/etat-des-lieux-sortie`, {});
  }

  edl(id: number): Observable<EtatDesLieux> {
    return this.http.get<EtatDesLieux>(`${this.api}/etats-des-lieux/${id}`);
  }

  enregistrerEdl(id: number, donnees: EnregistrementEdl): Observable<{ message: string; edl: EtatDesLieux }> {
    return this.http.put<{ message: string; edl: EtatDesLieux }>(`${this.api}/etats-des-lieux/${id}`, donnees);
  }

  validerEdl(id: number): Observable<{ message: string; edl: EtatDesLieux }> {
    return this.http.patch<{ message: string; edl: EtatDesLieux }>(`${this.api}/etats-des-lieux/${id}/validation`, {});
  }

  cloturer(bailId: number): Observable<{ message: string; total_retenues: number; impayes: number }> {
    return this.http.post<{ message: string; total_retenues: number; impayes: number }>(`${this.api}/baux/${bailId}/cloture`, {});
  }
}