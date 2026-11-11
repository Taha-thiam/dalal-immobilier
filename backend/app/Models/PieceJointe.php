<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PieceJointe extends Model
{
    protected $table = 'pieces_jointes';

    public $timestamps = false;

    protected $fillable = [
        'bail_id',
        'type',
        'fichier_url',
        'version',
        'date_ajout',
    ];

    protected function casts(): array
    {
        return [
            'date_ajout' => 'datetime',
        ];
    }

    public function bail(): BelongsTo
    {
        return $this->belongsTo(Bail::class);
    }
}
