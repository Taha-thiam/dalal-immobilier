<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Schema;

class Bail extends Model
{
    use HasFactory;

    protected $table = 'baux';


    /** Anciens noms, utilisés par BailService et BailController : à conserver */
    public const STATUT_ACTIF = 'actif';
    public const STATUT_EN_PREAVIS = 'en_preavis';
    public const STATUT_TERMINE = 'termine';
    public const STATUT_RESILIE = 'resilie';
    public const STATUT_RENOUVELE = 'renouvele';
    public const STATUTS = ['actif', 'en_preavis', 'termine', 'resilie', 'renouvele'];

    public const TYPE_HABITATION = 'habitation';
    public const TYPE_COMMERCIAL = 'commercial';
    public const TYPE_PROFESSIONNEL = 'professionnel';
    public const TYPES = ['habitation', 'commercial', 'professionnel'];

    /** Toutes les colonnes sont modifiables sauf l'id (y compris les nouvelles de fin de bail). */
    protected $guarded = ['id'];

    protected $casts = [
        'date_debut' => 'date:Y-m-d',
        'date_fin' => 'date:Y-m-d',
        'date_resiliation' => 'date:Y-m-d',
        'date_cloture' => 'date:Y-m-d',
    ];

    // ---------------------------------------------------------------
    // Relations principales
    // ---------------------------------------------------------------

    public function bien(): BelongsTo
    {
        return $this->belongsTo(Bien::class);
    }

    public function locataire(): BelongsTo
    {
        return $this->belongsTo(Locataire::class);
    }

    /** Échéancier : un mois = une échéance, dans l'ordre chronologique. */
    public function echeances(): HasMany
    {
        return $this->hasMany(Echeance::class)->orderBy('mois');
    }

    public function caution(): HasOne
    {
        return $this->hasOne(Caution::class);
    }

    /** Contrat généré, contrat signé scanné, pièces du dossier… */
    public function piecesJointes(): HasMany
    {
        return $this->hasMany(PieceJointe::class);
    }

    // ---------------------------------------------------------------
    // États des lieux
    // ---------------------------------------------------------------

    /** Tous les états des lieux du bail (entrée et sortie). */
    public function etatsDesLieux(): HasMany
    {
        return $this->hasMany(EtatDesLieux::class);
    }

    /** Le plus récent (conservé pour compatibilité avec le code existant). */
    public function etatDesLieux(): HasOne
    {
        return $this->hasOne(EtatDesLieux::class)->latestOfMany();
    }

    public function edlEntree(): HasOne
    {
        return $this->hasOne(EtatDesLieux::class)->where('type', EtatDesLieux::ENTREE);
    }

    public function edlSortie(): HasOne
    {
        return $this->hasOne(EtatDesLieux::class)->where('type', EtatDesLieux::SORTIE);
    }

    // ---------------------------------------------------------------
    // Renouvellement : chaîne ancien bail -> nouveau bail
    // ---------------------------------------------------------------

    /** Le bail que celui-ci renouvelle. */
    public function bailPrecedent(): BelongsTo
    {
        return $this->belongsTo(Bail::class, 'bail_precedent_id');
    }

    /** Le bail qui a renouvelé celui-ci. */
    public function renouvellement(): HasOne
    {
        return $this->hasOne(Bail::class, 'bail_precedent_id');
    }

    // ---------------------------------------------------------------
    // Relations utilisées par BailController (à conserver)
    // ---------------------------------------------------------------

    /** Le membre de l'agence qui a créé le bail */
    public function gestionnaire(): BelongsTo
    {
        $colonne = Schema::hasColumn('baux', 'gestionnaire_id') ? 'gestionnaire_id' : 'cree_par';

        return $this->belongsTo(User::class, $colonne);
    }

    /** Les contrats PDF générés (versions successives) */
    public function contrats(): HasMany
    {
        return $this->hasMany(PieceJointe::class)->where('type', 'contrat_genere')->orderByDesc('id');
    }

    // ---------------------------------------------------------------
    // Raccourcis
    // ---------------------------------------------------------------

    /** Le bail est-il définitivement clos ? */
    public function estClos(): bool
    {
        return in_array($this->statut, [self::TERMINE, self::RESILIE, self::RENOUVELE], true);
    }
}