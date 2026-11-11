<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Intervention extends Model
{
    use HasFactory;

    protected $table = 'interventions';

    // Statuts
    public const PLANIFIEE = 'planifiee';
    public const REALISEE  = 'realisee';
    public const ANNULEE   = 'annulee';

    /** Qui paie la réparation ? */
    public const CHARGES = ['proprietaire', 'locataire', 'agence'];

    protected $guarded = ['id'];

    protected $casts = [
        'date_prevue'      => 'datetime:Y-m-d H:i',
        'date_realisation' => 'date:Y-m-d',
        'cout'             => 'decimal:2',
    ];

    public function signalement(): BelongsTo
    {
        return $this->belongsTo(Signalement::class);
    }

    public function planifieePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'planifiee_par');
    }
}