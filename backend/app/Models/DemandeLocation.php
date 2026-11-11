<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DemandeLocation extends Model
{
    use HasFactory;

    protected $table = 'demandes_location';

    public const NOUVELLE = 'nouvelle';
    public const EN_COURS = 'en_cours';
    public const ACCEPTEE = 'acceptee';
    public const REFUSEE = 'refusee';

    protected $guarded = ['id'];

    protected $casts = [
        'date_entree_souhaitee' => 'date:Y-m-d',
        'date_visite' => 'datetime:Y-m-d H:i',
    ];

    /** L'IP sert à repérer le spam : elle ne sort jamais dans le JSON. */
    protected $hidden = ['ip'];

    public function bien(): BelongsTo
    {
        return $this->belongsTo(Bien::class);
    }

    public function traitePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'traite_par');
    }

    public function estOuverte(): bool
    {
        return in_array($this->statut, [self::NOUVELLE, self::EN_COURS], true);
    }
}