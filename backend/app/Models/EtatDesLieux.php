<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EtatDesLieux extends Model
{
    use HasFactory;

    protected $table = 'etats_des_lieux';

    public const ENTREE = 'entree';
    public const SORTIE = 'sortie';

    public const BROUILLON = 'brouillon';
    public const VALIDE    = 'valide';

    protected $guarded = ['id'];

    protected $casts = [
        'date_edl'       => 'date:Y-m-d',
        'total_retenues' => 'decimal:2',
        'nb_cles'        => 'integer',
    ];

    public function bail(): BelongsTo
    {
        return $this->belongsTo(Bail::class);
    }

    /** Les équipements contrôlés, regroupés par pièce. */
    public function elements(): HasMany
    {
        return $this->hasMany(ElementEdl::class, 'etat_des_lieux_id')->orderBy('piece')->orderBy('id');
    }

    public function realisePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'realise_par');
    }

    public function estValide(): bool
    {
        return $this->statut === self::VALIDE;
    }
}