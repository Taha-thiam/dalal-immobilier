import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MessageReponse, Page } from '../models/pagination.model';
import {
    Bien,
    BienDetail,
    BienSaisie,
    FiltresBien,
    ReponseBien,
    ReponsePhotos,
} from '../models/bien.model';

@Injectable({ providedIn: 'root' })
export class BienService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/biens`;

    // ===== Biens =====

    /** Liste paginée avec filtres. GET /biens?page=1&recherche=…&statut=…&type=… */
    lister(page = 1, filtres: FiltresBien = {}): Observable<Page<Bien>> {
        let params = new HttpParams().set('page', page);
        if (filtres.recherche?.trim()) params = params.set('recherche', filtres.recherche.trim());
        if (filtres.statut) params = params.set('statut', filtres.statut);
        if (filtres.type) params = params.set('type', filtres.type);
        if (filtres.proprietaire_id) params = params.set('proprietaire_id', filtres.proprietaire_id);
        return this.http.get<Page<Bien>>(this.url, { params });
    }

    afficher(id: number): Observable<BienDetail> {
        return this.http.get<BienDetail>(`${this.url}/${id}`);
    }

    creer(donnees: BienSaisie): Observable<ReponseBien> {
        return this.http.post<ReponseBien>(this.url, donnees);
    }

    modifier(id: number, donnees: BienSaisie): Observable<ReponseBien> {
        return this.http.put<ReponseBien>(`${this.url}/${id}`, donnees);
    }

    supprimer(id: number): Observable<MessageReponse> {
        return this.http.delete<MessageReponse>(`${this.url}/${id}`);
    }

    /** Publier (true) ou retirer du site (false) */
    publier(id: number, publie: boolean): Observable<ReponseBien> {
        return this.http.patch<ReponseBien>(`${this.url}/${id}/publication`, { publie });
    }

    /** Archiver (true) ou réactiver (false) */
    archiver(id: number, archive: boolean): Observable<ReponseBien> {
        return this.http.patch<ReponseBien>(`${this.url}/${id}/archivage`, { archive });
    }

    // ===== Photos =====

    /** Envoi de fichiers : FormData (et pas JSON) */
    ajouterPhotos(bienId: number, fichiers: File[]): Observable<ReponsePhotos> {
        const formulaire = new FormData();
        fichiers.forEach((f) => formulaire.append('photos[]', f));
        return this.http.post<ReponsePhotos>(`${this.url}/${bienId}/photos`, formulaire);
    }

    definirPrincipale(bienId: number, photoId: number): Observable<ReponsePhotos> {
        return this.http.patch<ReponsePhotos>(`${this.url}/${bienId}/photos/${photoId}/principale`, {});
    }

    supprimerPhoto(bienId: number, photoId: number): Observable<ReponsePhotos> {
        return this.http.delete<ReponsePhotos>(`${this.url}/${bienId}/photos/${photoId}`);
    }
}