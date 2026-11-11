<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Caution extends Model
{
    use HasFactory;

    protected $table = 'cautions';

    public const A_ENCAISSER = 'a_encaisser';
    public const ENCAISSEE   = 'encaissee';
    public const RESTITUEE   = 'restituee';

    /** Toutes les colonnes sont modifiables sauf l'id (plus souple que $fillable). */
    protected $guarded = ['id'];

    protected $casts = [
        'montant'            => 'decimal:2',
        'montant_retenu'     => 'decimal:2',
        'montant_rembourse'  => 'decimal:2',
        'date_encaissement'  => 'date:Y-m-d',
        'date_remboursement' => 'date:Y-m-d',
    ];

    public function bail(): BelongsTo
    {
        return $this->belongsTo(Bail::class);
    }

    public function encaissePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'encaisse_par');
    }

    public function remboursePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rembourse_par');
    }

    /** Montant à rendre si aucune retenue n'est appliquée. */
    public function montantRestituable(): float
    {
        return max(0, (float) $this->montant - (float) $this->montant_retenu);
    }
}