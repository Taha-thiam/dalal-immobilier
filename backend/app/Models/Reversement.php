<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Reversement extends Model
{
    use HasFactory;

    protected $table = 'reversements';

    public const A_PAYER = 'a_payer';
    public const PAYE    = 'paye';

    protected $guarded = ['id'];

    protected $casts = [
        'periode_debut' => 'date:Y-m-d',
        'periode_fin'   => 'date:Y-m-d',
        'date_paiement' => 'date:Y-m-d',
        'montant_brut'  => 'decimal:2',
        'commission'    => 'decimal:2',
        'montant_net'   => 'decimal:2',
    ];

    /** Le chemin du PDF est interne : on ne l'envoie jamais au navigateur. */
    protected $hidden = ['releve_path'];

    public function proprietaire(): BelongsTo
    {
        return $this->belongsTo(Proprietaire::class);
    }

    /** Les paiements de loyers inclus dans ce reversement (le « tampon »). */
    public function paiements(): HasMany
    {
        return $this->hasMany(Paiement::class, 'reversement_id');
    }

    public function creePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cree_par');
    }

    public function payePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paye_par');
    }
}