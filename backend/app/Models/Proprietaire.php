<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Proprietaire extends Model
{
    protected $fillable = [
        'user_id',
        'adresse',
        'numero_cni',
        'rib_reversement',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function biens(): HasMany
    {
        return $this->hasMany(Bien::class);
    }

    public function reversements(): HasMany
    {
        return $this->hasMany(Reversement::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(MessageContact::class);
    }
}
