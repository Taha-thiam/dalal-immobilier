<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function completer(string $table, array $colonnes): void
    {
        foreach ($colonnes as $nom => $definition) {
            if (! Schema::hasColumn($table, $nom)) {
                Schema::table($table, fn (Blueprint $t) => $definition($t));
            }
        }
    }

    private function libererEnum(string $table, string $colonne): void
    {
        if (Schema::hasColumn($table, $colonne)) {
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT IF EXISTS {$table}_{$colonne}_check");
        }
    }

    private function rendreFacultatives(string $table, array $colonnes): void
    {
        foreach ($colonnes as $col) {
            if (Schema::hasColumn($table, $col)) {
                DB::statement("ALTER TABLE {$table} ALTER COLUMN {$col} DROP NOT NULL");
            }
        }
    }

    public function up(): void
    {
        // ---------- SIGNALEMENTS : le problème déclaré ----------
        $this->completer('signalements', [
            'numero'       => fn (Blueprint $t) => $t->string('numero', 30)->nullable()->unique(),
            'bien_id'      => fn (Blueprint $t) => $t->foreignId('bien_id')->nullable()->constrained('biens')->cascadeOnDelete(),
            'bail_id'      => fn (Blueprint $t) => $t->foreignId('bail_id')->nullable()->constrained('baux')->nullOnDelete(),
            'locataire_id' => fn (Blueprint $t) => $t->foreignId('locataire_id')->nullable()->constrained('locataires')->nullOnDelete(),
            'titre'        => fn (Blueprint $t) => $t->string('titre', 150)->nullable(),
            'description'  => fn (Blueprint $t) => $t->text('description')->nullable(),
            'categorie'    => fn (Blueprint $t) => $t->string('categorie', 30)->default('autre'),
            'urgence'      => fn (Blueprint $t) => $t->string('urgence', 20)->default('normale'),   // faible | normale | haute
            'statut'       => fn (Blueprint $t) => $t->string('statut', 20)->default('nouveau'),    // nouveau | en_cours | resolu | rejete
            'motif_rejet'  => fn (Blueprint $t) => $t->text('motif_rejet')->nullable(),
            'date_resolution' => fn (Blueprint $t) => $t->date('date_resolution')->nullable(),
            'declare_par'  => fn (Blueprint $t) => $t->foreignId('declare_par')->nullable()->constrained('users')->nullOnDelete(),
        ]);
        $this->libererEnum('signalements', 'statut');
        $this->libererEnum('signalements', 'categorie');
        $this->libererEnum('signalements', 'urgence');
        $this->libererEnum('signalements', 'priorite');
        $this->rendreFacultatives('signalements', ['objet', 'type', 'priorite', 'date_signalement', 'user_id']);

        // ---------- INTERVENTIONS : la réparation ----------
        $this->completer('interventions', [
            'signalement_id'        => fn (Blueprint $t) => $t->foreignId('signalement_id')->nullable()->constrained('signalements')->cascadeOnDelete(),
            'prestataire_nom'       => fn (Blueprint $t) => $t->string('prestataire_nom', 120)->nullable(),
            'prestataire_telephone' => fn (Blueprint $t) => $t->string('prestataire_telephone', 30)->nullable(),
            'date_prevue'           => fn (Blueprint $t) => $t->dateTime('date_prevue')->nullable(),
            'date_realisation'      => fn (Blueprint $t) => $t->date('date_realisation')->nullable(),
            'cout'                  => fn (Blueprint $t) => $t->decimal('cout', 12, 2)->nullable(),
            'a_charge_de'           => fn (Blueprint $t) => $t->string('a_charge_de', 20)->nullable(), // proprietaire | locataire | agence
            'rapport'               => fn (Blueprint $t) => $t->text('rapport')->nullable(),
            'statut'                => fn (Blueprint $t) => $t->string('statut', 20)->default('planifiee'), // planifiee | realisee | annulee
            'planifiee_par'         => fn (Blueprint $t) => $t->foreignId('planifiee_par')->nullable()->constrained('users')->nullOnDelete(),
        ]);
        $this->libererEnum('interventions', 'statut');
        $this->libererEnum('interventions', 'a_charge_de');
        $this->rendreFacultatives('interventions', ['technicien', 'prestataire', 'description', 'date_intervention', 'montant']);
    }

    public function down(): void
    {
        // Migration de complément : pas de retour arrière destructif.
    }
};