<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DemandeMotDePasse extends Model
{
    protected $table = 'demandes_mot_de_passe';

    protected $guarded = ['id'];

    protected $casts = ['traite_le' => 'datetime'];

    protected $hidden = ['ip'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function traitePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'traite_par');
    }
}