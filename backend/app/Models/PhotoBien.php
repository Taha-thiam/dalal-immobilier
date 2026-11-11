<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PhotoBien extends Model
{
    protected $table = 'photos_biens';

    protected $fillable = [
        'bien_id',
        'url',
        'ordre',
    ];

    public function bien(): BelongsTo
    {
        return $this->belongsTo(Bien::class);
    }
}
