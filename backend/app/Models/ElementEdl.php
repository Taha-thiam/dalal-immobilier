<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ElementEdl extends Model
{
    use HasFactory;

    protected $table = 'elements_edl';

    public const ETATS = ['bon', 'moyen', 'mauvais'];

    protected $guarded = ['id'];

    protected $casts = [
        'montant_retenue' => 'decimal:2',
    ];

    public function etatDesLieux(): BelongsTo
    {
        return $this->belongsTo(EtatDesLieux::class, 'etat_des_lieux_id');
    }
}