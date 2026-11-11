<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Toutes les tables métier : on vérifie chacune. */
    private array $tables = [
        'parametres_agence', 'journal_activites', 'proprietaires', 'locataires', 'messages_contact',
        'biens', 'photos_biens', 'demandes_location', 'baux', 'pieces_jointes', 'etats_des_lieux',
        'elements_edl', 'echeances', 'paiements', 'quittances', 'cautions', 'reversements',
        'signalements', 'interventions',
    ];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            foreach (['created_at', 'updated_at'] as $colonne) {
                if (! Schema::hasColumn($table, $colonne)) {
                    Schema::table($table, fn (Blueprint $t) => $t->timestamp($colonne)->nullable()->useCurrent());
                }
            }
        }
    }

    public function down(): void
    {
        // Migration de complément : pas de retour arrière destructif.
    }
};