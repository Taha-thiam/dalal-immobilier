import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MessageReponse, Page } from '../models/pagination.model';
import {
    CreationLocataireReponse,
    Locataire,
    LocataireDetail,
    LocataireSaisie,
    ModificationLocataireReponse,
} from '../models/locataire.model';

@Injectable({ providedIn: 'root' })
export class LocataireService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/locataires`;

    /** Liste paginée, avec recherche (nom, email, téléphone, CNI). GET /locataires?page=1&recherche=fall */
    lister(page = 1, recherche = ''): Observable<Page<Locataire>> {
        let params = new HttpParams().set('page', page);
        if (recherche.trim()) {
            params = params.set('recherche', recherche.trim());
        }
        return this.http.get<Page<Locataire>>(this.url, { params });
    }

    /** Détail, avec l'historique des baux. GET /locataires/{id} */
    afficher(id: number): Observable<LocataireDetail> {
        return this.http.get<LocataireDetail>(`${this.url}/${id}`);
    }

    /** Création. POST /locataires */
    creer(donnees: LocataireSaisie): Observable<CreationLocataireReponse> {
        return this.http.post<CreationLocataireReponse>(this.url, donnees);
    }

    /** Modification. PUT /locataires/{id} */
    modifier(id: number, donnees: LocataireSaisie): Observable<ModificationLocataireReponse> {
        return this.http.put<ModificationLocataireReponse>(`${this.url}/${id}`, donnees);
    }

    /** Suppression. DELETE /locataires/{id} */
    supprimer(id: number): Observable<MessageReponse> {
        return this.http.delete<MessageReponse>(`${this.url}/${id}`);
    }
}