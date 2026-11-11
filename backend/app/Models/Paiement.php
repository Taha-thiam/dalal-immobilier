<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Paiement extends Model
{
    protected $fillable = [
        'echeance_id',
        'comptable_id',
        'montant',
        'date_paiement',
        'mode_paiement',
        'reference',
        'statut',
        'motif_annulation',
    ];

    protected function casts(): array
    {
        return [
            'montant' => 'decimal:2',
            'date_paiement' => 'date',
        ];
    }

    public function echeance(): BelongsTo
    {
        return $this->belongsTo(Echeance::class);
    }

    public function comptable(): BelongsTo
    {
        return $this->belongsTo(User::class, 'comptable_id');
    }

    public function quittance(): HasOne
    {
        return $this->hasOne(Quittance::class);
    }
}
