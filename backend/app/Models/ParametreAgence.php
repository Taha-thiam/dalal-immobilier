<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ParametreAgence extends Model
{
    protected $table = 'parametres_agence';

    protected $fillable = [
        'nom_agence',
        'adresse',
        'telephone',
        'logo_url',
        'taux_commission_defaut',
        'modele_contrat',
        'modele_quittance',
    ];

    protected function casts(): array
    {
        return [
            'taux_commission_defaut' => 'decimal:2',
        ];
    }
}
