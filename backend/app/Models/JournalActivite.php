<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JournalActivite extends Model
{
    protected $table = 'journal_activites';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'action',
        'entite',
        'entite_id',
        'details',
        'date_heure',
    ];

    protected function casts(): array
    {
        return [
            'date_heure' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
