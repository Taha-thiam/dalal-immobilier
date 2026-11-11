<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Locataire extends Model
{
    protected $fillable = [
        'user_id',
        'numero_cni',
        'profession',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function baux(): HasMany
    {
        return $this->hasMany(Bail::class);
    }

    public function signalements(): HasMany
    {
        return $this->hasMany(Signalement::class);
    }

    public function demandes(): HasMany
    {
        return $this->hasMany(DemandeLocation::class);
    }
}
