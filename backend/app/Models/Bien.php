<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Bien extends Model
{
    protected $fillable = [
        'proprietaire_id',
        'reference',
        'type',
        'titre',
        'quartier',
        'adresse',
        'surface',
        'nb_pieces',
        'loyer_propose',
        'caution',
        'description',
        'taux_commission',
        'statut',
        'publie',
    ];

    protected function casts(): array
    {
        return [
            'surface' => 'decimal:2',
            'loyer_propose' => 'decimal:2',
            'caution' => 'decimal:2',
            'taux_commission' => 'decimal:2',
            'publie' => 'boolean',
        ];
    }

    public const STATUT_LIBRE = 'libre';
    public const STATUT_LOUE = 'loue';
    public const STATUT_ARCHIVE = 'archive';

    /** Biens visibles sur le portail public : libres et publiés. */
    public function scopePublics(Builder $query): Builder
    {
        return $query->where('statut', self::STATUT_LIBRE)->where('publie', true);
    }

    public function proprietaire(): BelongsTo
    {
        return $this->belongsTo(Proprietaire::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(PhotoBien::class)->orderBy('ordre');
    }

    public function baux(): HasMany
    {
        return $this->hasMany(Bail::class);
    }

    public function bailActif(): HasOne
    {
        return $this->hasOne(Bail::class)->where('statut', 'actif');
    }

    public function demandes(): HasMany
    {
        return $this->hasMany(DemandeLocation::class);
    }

    public function signalements(): HasMany
    {
        return $this->hasMany(Signalement::class);
    }
}
