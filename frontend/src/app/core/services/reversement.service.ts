import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MessageReponse, Page } from '../models/pagination.model';
import { Apercu, PaiementReversement, Reversement, StatutReversement } from '../models/reversement.model';

@Injectable({ providedIn: 'root' })
export class ReversementService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/reversements`;

    apercu(jusquau: string): Observable<Apercu> {
        return this.http.get<Apercu>(`${this.url}/apercu`, { params: { jusquau } });
    }

    lister(page = 1, statut: StatutReversement | '' = '', recherche = ''): Observable<Page<Reversement>> {
        let params = new HttpParams().set('page', page);
        if (statut) params = params.set('statut', statut);
        if (recherche.trim()) params = params.set('recherche', recherche.trim());
        return this.http.get<Page<Reversement>>(this.url, { params });
    }

    creer(proprietaireId: number, jusquau: string): Observable<{ message: string; reversement: Reversement }> {
        return this.http.post<{ message: string; reversement: Reversement }>(this.url, {
            proprietaire_id: proprietaireId,
            jusquau,
        });
    }

    payer(id: number, donnees: PaiementReversement): Observable<{ message: string; reversement: Reversement }> {
        return this.http.patch<{ message: string; reversement: Reversement }>(`${this.url}/${id}/payer`, donnees);
    }

    supprimer(id: number): Observable<MessageReponse> {
        return this.http.delete<MessageReponse>(`${this.url}/${id}`);
    }

    /** Le PDF passe par le token : on le récupère en Blob. */
    telechargerReleve(id: number): Observable<Blob> {
        return this.http.get(`${this.url}/${id}/releve`, { responseType: 'blob' });
    }

    regenererReleve(id: number): Observable<MessageReponse> {
        return this.http.post<MessageReponse>(`${this.url}/${id}/releve`, {});
    }
}