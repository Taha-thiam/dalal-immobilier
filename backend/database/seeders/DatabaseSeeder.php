<?php

namespace Database\Seeders;

use App\Models\ParametreAgence;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        ParametreAgence::firstOrCreate([], [
            'nom_agence' => 'Dalal Immobilier',
            'adresse' => 'Sacré-Cœur 3, Dakar, Sénégal',
            'telephone' => '33 800 00 00',
            'taux_commission_defaut' => 10,
        ]);

        // Comptes du personnel pour les tests (mot de passe à changer en production)
        $comptes = [
            ['nom' => 'Diallo', 'prenom' => 'Fatou',  'email' => 'admin@dalal.test',        'role' => User::ROLE_ADMINISTRATEUR, 'matricule' => 'DI-ADM-001'],
            ['nom' => 'Sow',    'prenom' => 'Awa',    'email' => 'gestionnaire@dalal.test', 'role' => User::ROLE_GESTIONNAIRE,   'matricule' => 'DI-GES-001'],
            ['nom' => 'Ndiaye', 'prenom' => 'Moussa', 'email' => 'comptable@dalal.test',    'role' => User::ROLE_COMPTABLE,      'matricule' => 'DI-CPT-001'],
        ];

        foreach ($comptes as $compte) {
            User::updateOrCreate(
                ['email' => $compte['email']],
                $compte + ['statut' => 'actif', 'password' => 'Dalal@2026']
            );
        }
    }
}