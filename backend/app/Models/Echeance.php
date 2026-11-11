<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Echeance extends Model
{
    protected $fillable = [
        'bail_id',
        'mois',
        'montant_du',
        'date_limite',
        'reste_du',
        'statut',
    ];

    protected function casts(): array
    {
        return [
            'mois' => 'date',
            'date_limite' => 'date',
            'montant_du' => 'decimal:2',
            'reste_du' => 'decimal:2',
        ];
    }

    public function bail(): BelongsTo
    {
        return $this->belongsTo(Bail::class);
    }

    public function paiements(): HasMany
    {
        return $this->hasMany(Paiement::class);
    }
}
