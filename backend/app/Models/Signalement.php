<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Signalement extends Model
{
    use HasFactory;

    protected $table = 'signalements';

    // Statuts
    public const NOUVEAU  = 'nouveau';
    public const EN_COURS = 'en_cours';
    public const RESOLU   = 'resolu';
    public const REJETE   = 'rejete';

    public const CATEGORIES = ['plomberie', 'electricite', 'climatisation', 'serrurerie', 'peinture', 'menuiserie', 'autre'];
    public const URGENCES   = ['faible', 'normale', 'haute'];

    protected $guarded = ['id'];

    protected $casts = [
        'date_resolution' => 'date:Y-m-d',
    ];

    public function bien(): BelongsTo
    {
        return $this->belongsTo(Bien::class);
    }

    public function bail(): BelongsTo
    {
        return $this->belongsTo(Bail::class);
    }

    public function locataire(): BelongsTo
    {
        return $this->belongsTo(Locataire::class);
    }

    public function declarePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'declare_par');
    }

    /** Un signalement peut demander plusieurs passages (1re visite, retour avec la pièce…). */
    public function interventions(): HasMany
    {
        return $this->hasMany(Intervention::class)->orderByDesc('id');
    }

    public function estOuvert(): bool
    {
        return in_array($this->statut, [self::NOUVEAU, self::EN_COURS], true);
    }
}