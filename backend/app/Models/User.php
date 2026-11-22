<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_ADMINISTRATEUR = 'administrateur';
    public const ROLE_GESTIONNAIRE = 'gestionnaire';
    public const ROLE_COMPTABLE = 'comptable';
    public const ROLE_PROPRIETAIRE = 'proprietaire';
    public const ROLE_LOCATAIRE = 'locataire';
    /** Mot de passe donné à tout nouveau compte et après une réinitialisation par l'admin */
    public const MOT_DE_PASSE_DEFAUT = 'passer';

    protected $fillable = [
        'nom',
        'prenom',
        'email',
        'telephone',
        'role',
        'statut',
        'matricule',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function proprietaire(): HasOne
    {
        return $this->hasOne(Proprietaire::class);
    }

    public function locataire(): HasOne
    {
        return $this->hasOne(Locataire::class);
    }

    public function journal(): HasMany
    {
        return $this->hasMany(JournalActivite::class);
    }

    public function aLeRole(string ...$roles): bool
    {
        return in_array($this->role, $roles, true);
    }

    public function estActif(): bool
    {
        return $this->statut === 'actif';
    }
}
