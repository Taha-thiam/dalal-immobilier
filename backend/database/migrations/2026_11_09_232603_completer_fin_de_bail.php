<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Ajoute chaque colonne seulement si elle manque. */
    private function completer(string $table, array $colonnes): void
    {
        foreach ($colonnes as $nom => $definition) {
            if (! Schema::hasColumn($table, $nom)) {
                Schema::table($table, fn (Blueprint $t) => $definition($t));
            }
        }
    }

    /** Retire les contraintes « enum » PostgreSQL pour accepter les nouveaux statuts. */
    private function libererEnum(string $table, string $colonne): void
    {
        if (Schema::hasColumn($table, $colonne)) {
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT IF EXISTS {$table}_{$colonne}_check");
        }
    }

    public function up(): void
    {
        // ---------- BAUX : informations de fin ----------
        $this->completer('baux', [
            'date_resiliation'  => fn (Blueprint $t) => $t->date('date_resiliation')->nullable(),
            'motif_resiliation' => fn (Blueprint $t) => $t->text('motif_resiliation')->nullable(),
            'initiative'        => fn (Blueprint $t) => $t->string('initiative', 20)->nullable(), // locataire | proprietaire | agence
            'date_cloture'      => fn (Blueprint $t) => $t->date('date_cloture')->nullable(),
        ]);
        $this->libererEnum('baux', 'statut'); // actif, en_preavis, termine, resilie, renouvele

        // ---------- ÉTATS DES LIEUX ----------
        $this->completer('etats_des_lieux', [
            'bail_id'         => fn (Blueprint $t) => $t->foreignId('bail_id')->nullable()->constrained('baux')->cascadeOnDelete(),
            'type'            => fn (Blueprint $t) => $t->string('type', 10)->default('sortie'), // entree | sortie
            'date_edl'        => fn (Blueprint $t) => $t->date('date_edl')->nullable(),
            'observations'    => fn (Blueprint $t) => $t->text('observations')->nullable(),
            'index_eau'       => fn (Blueprint $t) => $t->string('index_eau', 30)->nullable(),
            'index_electricite' => fn (Blueprint $t) => $t->string('index_electricite', 30)->nullable(),
            'nb_cles'         => fn (Blueprint $t) => $t->unsignedSmallInteger('nb_cles')->nullable(),
            'total_retenues'  => fn (Blueprint $t) => $t->decimal('total_retenues', 12, 2)->default(0),
            'statut'          => fn (Blueprint $t) => $t->string('statut', 20)->default('brouillon'), // brouillon | valide
            'realise_par'     => fn (Blueprint $t) => $t->foreignId('realise_par')->nullable()->constrained('users')->nullOnDelete(),
        ]);
        $this->libererEnum('etats_des_lieux', 'type');
        $this->libererEnum('etats_des_lieux', 'statut');

        // ---------- ÉLÉMENTS (une ligne par équipement contrôlé) ----------
        $this->completer('elements_edl', [
            'etat_des_lieux_id' => fn (Blueprint $t) => $t->foreignId('etat_des_lieux_id')->nullable()->constrained('etats_des_lieux')->cascadeOnDelete(),
            'piece'             => fn (Blueprint $t) => $t->string('piece', 60)->nullable(),   // Salon, Cuisine…
            'element'           => fn (Blueprint $t) => $t->string('element', 80)->nullable(), // Murs, Vitres…
            'etat'              => fn (Blueprint $t) => $t->string('etat', 20)->default('bon'), // bon | moyen | mauvais
            'commentaire'       => fn (Blueprint $t) => $t->text('commentaire')->nullable(),
            'montant_retenue'   => fn (Blueprint $t) => $t->decimal('montant_retenue', 12, 2)->default(0),
        ]);
        $this->libererEnum('elements_edl', 'etat');

        // Anciennes colonnes obligatoires que je ne connais pas : on les rend facultatives
        foreach (['etats_des_lieux' => ['date', 'date_realisation', 'etat_general'],
                  'elements_edl'    => ['nom', 'libelle', 'observation']] as $table => $cols) {
            foreach ($cols as $col) {
                if (Schema::hasColumn($table, $col)) {
                    DB::statement("ALTER TABLE {$table} ALTER COLUMN {$col} DROP NOT NULL");
                }
            }
        }
    }

    public function down(): void
    {
        // Migration de complément : pas de retour arrière destructif.
    }
};