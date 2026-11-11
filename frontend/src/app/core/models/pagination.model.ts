/**
 * Format d'une liste paginée renvoyée par Laravel (->paginate()).
 * <T> = le type des éléments : Proprietaire, Bien, Bail…
 */
export interface Page<T> {
    data: T[];             // les éléments de la page actuelle
    current_page: number;  // numéro de la page actuelle
    last_page: number;     // numéro de la dernière page
    per_page: number;      // éléments par page (10)
    total: number;         // nombre total d'éléments
    from: number | null;   // position du premier élément affiché
    to: number | null;     // position du dernier élément affiché
}

/** Réponse simple de Laravel : { "message": "..." } */
export interface MessageReponse {
    message: string;
}