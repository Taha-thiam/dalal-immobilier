import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../models/pagination.model';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface PhotoAnnonce {
    id: number;
    url: string | null;
    principale: boolean;
}

export interface Annonce {
    id: number;
    reference: string;
    titre: string;
    description?: string | null;
    quartier: string | null;
    ville?: string | null;
    loyer: number;
    charges?: number | string | null;
    caution?: number | string | null;
    type_bien: string | null;
    pieces: number | null;
    surface: number | string | null;
    meuble?: boolean | null;
    photo_principale: string | null;
    photos: PhotoAnnonce[];
    [cle: string]: unknown; // les autres champs du bien (chambres, salles de bain…)
}

export interface Filtres {
    quartiers: string[];
    types: string[];
}

export interface Agence {
    nom: string;
    slogan: string;
    adresse: string;
    telephone: string | null;
    email: string | null;
}

export interface CriteresRecherche {
    recherche?: string;
    quartier?: string;
    type?: string;
    prix_max?: number | null;
    pieces_min?: number | null;
}

export interface DemandeVisiteur {
    prenom: string;
    nom: string;
    telephone: string;
    email: string | null;
    profession: string | null;
    date_entree_souhaitee: string | null;
    message: string | null;
    site_web: string; // piège à robots : toujours vide
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class PortailService {
    private http = inject(HttpClient);
    private api = `${environment.apiUrl}/public`;

    annonces(page = 1, c: CriteresRecherche = {}): Observable<Page<Annonce>> {
        let params = new HttpParams().set('page', page);
        if (c.recherche?.trim()) params = params.set('recherche', c.recherche.trim());
        if (c.quartier) params = params.set('quartier', c.quartier);
        if (c.type) params = params.set('type', c.type);
        if (c.prix_max) params = params.set('prix_max', c.prix_max);
        if (c.pieces_min) params = params.set('pieces_min', c.pieces_min);
        return this.http.get<Page<Annonce>>(`${this.api}/annonces`, { params });
    }

    annonce(id: number): Observable<Annonce> {
        return this.http.get<Annonce>(`${this.api}/annonces/${id}`);
    }

    filtres(): Observable<Filtres> {
        return this.http.get<Filtres>(`${this.api}/filtres`);
    }

    agence(): Observable<Agence> {
        return this.http.get<Agence>(`${this.api}/agence`);
    }

    demander(id: number, d: DemandeVisiteur): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(`${this.api}/annonces/${id}/demandes`, d);
    }

    contacter(d: { nom: string; email: string | null; telephone: string | null; sujet: string | null; message: string; site_web: string }): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(`${this.api}/contact`, d);
    }
}