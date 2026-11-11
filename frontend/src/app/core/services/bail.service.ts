import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MessageReponse, Page } from '../models/pagination.model';
import { Bail, BailDetail, BailSaisie, ReponseBail, StatutBail } from '../models/bail.model';

@Injectable({ providedIn: 'root' })
export class BailService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/baux`;

    /** Liste paginée. GET /baux?page=1&recherche=…&statut=… */
    lister(page = 1, recherche = '', statut: StatutBail | '' = ''): Observable<Page<Bail>> {
        let params = new HttpParams().set('page', page);
        if (recherche.trim()) params = params.set('recherche', recherche.trim());
        if (statut) params = params.set('statut', statut);
        return this.http.get<Page<Bail>>(this.url, { params });
    }

    afficher(id: number): Observable<BailDetail> {
        return this.http.get<BailDetail>(`${this.url}/${id}`);
    }

    creer(donnees: BailSaisie): Observable<ReponseBail> {
        return this.http.post<ReponseBail>(this.url, donnees);
    }

    /**
     * Télécharge le contrat PDF.
     * On le récupère comme un « blob » (fichier binaire), car un simple lien <a href>
     * n'enverrait pas le jeton d'authentification.
     */
    telechargerContrat(id: number): Observable<Blob> {
        return this.http.get(`${this.url}/${id}/contrat`, { responseType: 'blob' });
    }

    regenererContrat(id: number): Observable<MessageReponse> {
        return this.http.post<MessageReponse>(`${this.url}/${id}/contrat`, {});
    }
}