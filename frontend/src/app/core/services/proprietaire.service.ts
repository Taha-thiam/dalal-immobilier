import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MessageReponse, Page } from '../models/pagination.model';
import {
    CreationProprietaireReponse,
    ModificationProprietaireReponse,
    Proprietaire,
    ProprietaireSaisie,
} from '../models/proprietaire.model';

@Injectable({ providedIn: 'root' })
export class ProprietaireService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/proprietaires`;

    /** Liste paginée, avec recherche facultative. GET /proprietaires?page=1&recherche=diop */
    lister(page = 1, recherche = ''): Observable<Page<Proprietaire>> {
        let params = new HttpParams().set('page', page);
        if (recherche.trim()) {
            params = params.set('recherche', recherche.trim());
        }
        return this.http.get<Page<Proprietaire>>(this.url, { params });
    }

    /** Détail d'un propriétaire. GET /proprietaires/{id} */
    afficher(id: number): Observable<Proprietaire> {
        return this.http.get<Proprietaire>(`${this.url}/${id}`);
    }

    /** Création. POST /proprietaires */
    creer(donnees: ProprietaireSaisie): Observable<CreationProprietaireReponse> {
        return this.http.post<CreationProprietaireReponse>(this.url, donnees);
    }

    /** Modification. PUT /proprietaires/{id} */
    modifier(id: number, donnees: ProprietaireSaisie): Observable<ModificationProprietaireReponse> {
        return this.http.put<ModificationProprietaireReponse>(`${this.url}/${id}`, donnees);
    }

    /** Suppression. DELETE /proprietaires/{id} */
    supprimer(id: number): Observable<MessageReponse> {
        return this.http.delete<MessageReponse>(`${this.url}/${id}`);
    }
}