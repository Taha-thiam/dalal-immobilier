<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Quittance extends Model
{
    protected $fillable = [
        'paiement_id',
        'numero',
        'date_emission',
        'fichier_url',
    ];

    protected function casts(): array
    {
        return [
            'date_emission' => 'date',
        ];
    }

    public function paiement(): BelongsTo
    {
        return $this->belongsTo(Paiement::class);
    }
}
