import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../models/pagination.model';
import { Caution, EncaissementCaution, RestitutionCaution, StatutCaution } from '../models/caution.model';

@Injectable({ providedIn: 'root' })
export class CautionService {
    private http = inject(HttpClient);
    private url = `${environment.apiUrl}/cautions`;

    lister(page = 1, statut: StatutCaution | '' = '', recherche = ''): Observable<Page<Caution>> {
        let params = new HttpParams().set('page', page);
        if (statut) params = params.set('statut', statut);
        if (recherche.trim()) params = params.set('recherche', recherche.trim());
        return this.http.get<Page<Caution>>(this.url, { params });
    }

    encaisser(id: number, donnees: EncaissementCaution): Observable<{ message: string; caution: Caution }> {
        return this.http.patch<{ message: string; caution: Caution }>(`${this.url}/${id}/encaisser`, donnees);
    }

    restituer(id: number, donnees: RestitutionCaution): Observable<{ message: string; caution: Caution }> {
        return this.http.patch<{ message: string; caution: Caution }>(`${this.url}/${id}/restituer`, donnees);
    }
}