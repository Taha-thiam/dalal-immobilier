import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../models/pagination.model';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type StatutSignalement = 'nouveau' | 'en_cours' | 'resolu' | 'rejete';
export type Urgence = 'faible' | 'normale' | 'haute';
export type Categorie = 'plomberie' | 'electricite' | 'climatisation' | 'serrurerie' | 'peinture' | 'menuiserie' | 'autre';
export type StatutIntervention = 'planifiee' | 'realisee' | 'annulee';
export type ACharge = 'proprietaire' | 'locataire' | 'agence';

export interface Intervention {
    id: number;
    signalement_id: number;
    prestataire_nom: string;
    prestataire_telephone: string | null;
    date_prevue: string;
    date_realisation: string | null;
    cout: string | null;
    a_charge_de: ACharge | null;
    rapport: string | null;
    statut: StatutIntervention;
}

export interface Signalement {
    id: number;
    numero: string;
    titre: string;
    description: string | null;
    categorie: Categorie;
    urgence: Urgence;
    statut: StatutSignalement;
    motif_rejet: string | null;
    date_resolution: string | null;
    created_at: string;
    cout_total: number;
    bien: { id: number; titre: string; reference: string; quartier: string | null } | null;
    locataire: { nom: string; prenom: string; telephone: string | null } | null;
    interventions: Intervention[];
}

export type Reponse = { message: string; signalement: Signalement };

// ------------------------------------------------------------------
// Libellés et couleurs néon
// ------------------------------------------------------------------

export const STATUTS_SIGNALEMENT: Record<StatutSignalement, { libelle: string; classe: string }> = {
    nouveau: { libelle: 'Nouveau', classe: 'border-neon-rouge/60 bg-neon-rouge/10 text-neon-rouge' },
    en_cours: { libelle: 'En cours', classe: 'border-amber-300/60 bg-amber-300/10 text-amber-300' },
    resolu: { libelle: 'Résolu', classe: 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' },
    rejete: { libelle: 'Rejeté', classe: 'border-slate-500/60 text-slate-500' },
};

export const URGENCES: { valeur: Urgence; libelle: string; classe: string }[] = [
    { valeur: 'faible', libelle: 'Faible', classe: 'text-slate-400' },
    { valeur: 'normale', libelle: 'Normale', classe: 'text-neon-bleu' },
    { valeur: 'haute', libelle: 'Haute', classe: 'text-neon-rouge text-glow-rouge' },
];

export const CATEGORIES: { valeur: Categorie; libelle: string; icone: string }[] = [
    { valeur: 'plomberie', libelle: 'Plomberie', icone: '🚰' },
    { valeur: 'electricite', libelle: 'Électricité', icone: '⚡' },
    { valeur: 'climatisation', libelle: 'Climatisation', icone: '❄️' },
    { valeur: 'serrurerie', libelle: 'Serrurerie', icone: '🔑' },
    { valeur: 'peinture', libelle: 'Peinture', icone: '🎨' },
    { valeur: 'menuiserie', libelle: 'Menuiserie', icone: '🚪' },
    { valeur: 'autre', libelle: 'Autre', icone: '🔧' },
];

export const CHARGES: { valeur: ACharge; libelle: string }[] = [
    { valeur: 'proprietaire', libelle: 'Propriétaire' },
    { valeur: 'locataire', libelle: 'Locataire' },
    { valeur: 'agence', libelle: 'Agence' },
];

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
    private http = inject(HttpClient);
    private api = environment.apiUrl;

    lister(page = 1, statut = '', urgence = '', recherche = ''): Observable<Page<Signalement>> {
        let params = new HttpParams().set('page', page);
        if (statut) params = params.set('statut', statut);
        if (urgence) params = params.set('urgence', urgence);
        if (recherche.trim()) params = params.set('recherche', recherche.trim());
        return this.http.get<Page<Signalement>>(`${this.api}/signalements`, { params });
    }

    signaler(donnees: { bien_id: number; titre: string; description: string | null; categorie: Categorie; urgence: Urgence }): Observable<Reponse> {
        return this.http.post<Reponse>(`${this.api}/signalements`, donnees);
    }

    planifier(id: number, donnees: { prestataire_nom: string; prestataire_telephone: string | null; date_prevue: string }): Observable<Reponse> {
        return this.http.post<Reponse>(`${this.api}/signalements/${id}/interventions`, donnees);
    }

    realiser(interventionId: number, donnees: { date_realisation: string; cout: number; a_charge_de: ACharge | null; rapport: string | null }): Observable<Reponse> {
        return this.http.patch<Reponse>(`${this.api}/interventions/${interventionId}/realisation`, donnees);
    }

    annulerIntervention(interventionId: number, motif: string | null): Observable<Reponse> {
        return this.http.patch<Reponse>(`${this.api}/interventions/${interventionId}/annulation`, { motif });
    }

    resoudre(id: number): Observable<Reponse> {
        return this.http.patch<Reponse>(`${this.api}/signalements/${id}/resolution`, {});
    }

    rejeter(id: number, motif: string): Observable<Reponse> {
        return this.http.patch<Reponse>(`${this.api}/signalements/${id}/rejet`, { motif });
    }
}   