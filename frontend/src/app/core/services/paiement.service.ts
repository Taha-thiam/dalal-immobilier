import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MessageReponse, Page } from '../models/pagination.model';
import {
    EcheanceAEncaisser,
    Paiement,
    PaiementSaisie,
    ReponsePaiement,
    StatutPaiement,
} from '../models/paiement.model';

@Injectable({ providedIn: 'root' })
export class PaiementService {
    private http = inject(HttpClient);
    private api = environment.apiUrl;

    // ===== Échéances à encaisser =====

    /** GET /echeances?page=1&recherche=…&en_retard=1 */
    echeances(page = 1, recherche = '', enRetard = false): Observable<Page<EcheanceAEncaisser>> {
        let params = new HttpParams().set('page', page);
        if (recherche.trim()) params = params.set('recherche', recherche.trim());
        if (enRetard) params = params.set('en_retard', 1);
        return this.http.get<Page<EcheanceAEncaisser>>(`${this.api}/echeances`, { params });
    }

    // ===== Paiements =====

    /** GET /paiements?page=1&statut=…&recherche=… */
    lister(page = 1, statut: StatutPaiement | '' = '', recherche = ''): Observable<Page<Paiement>> {
        let params = new HttpParams().set('page', page);
        if (statut) params = params.set('statut', statut);
        if (recherche.trim()) params = params.set('recherche', recherche.trim());
        return this.http.get<Page<Paiement>>(`${this.api}/paiements`, { params });
    }

    enregistrer(donnees: PaiementSaisie): Observable<ReponsePaiement> {
        return this.http.post<ReponsePaiement>(`${this.api}/paiements`, donnees);
    }

    valider(id: number): Observable<ReponsePaiement> {
        return this.http.patch<ReponsePaiement>(`${this.api}/paiements/${id}/valider`, {});
    }

    annuler(id: number, motif: string): Observable<ReponsePaiement> {
        return this.http.patch<ReponsePaiement>(`${this.api}/paiements/${id}/annuler`, { motif });
    }

    // ===== Quittances =====

    /** Fichier PDF (blob), récupéré avec le jeton grâce à l'intercepteur */
    telechargerQuittance(paiementId: number): Observable<Blob> {
        return this.http.get(`${this.api}/paiements/${paiementId}/quittance`, { responseType: 'blob' });
    }

    regenererQuittance(paiementId: number): Observable<MessageReponse> {
        return this.http.post<MessageReponse>(`${this.api}/paiements/${paiementId}/quittance`, {});
    }
}