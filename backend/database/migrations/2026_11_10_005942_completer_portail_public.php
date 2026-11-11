<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    private function completer(string $table, array $colonnes): void
    {
        foreach ($colonnes as $nom => $definition) {
            if (!Schema::hasColumn($table, $nom)) {
                Schema::table($table, fn(Blueprint $t) => $definition($t));
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
        // ---------- DEMANDES DE LOCATION (envoyées par les visiteurs) ----------
        $this->completer('demandes_location', [
            'numero' => fn(Blueprint $t) => $t->string('numero', 30)->nullable()->unique(),
            'bien_id' => fn(Blueprint $t) => $t->foreignId('bien_id')->nullable()->constrained('biens')->cascadeOnDelete(),
            'nom' => fn(Blueprint $t) => $t->string('nom', 80)->nullable(),
            'prenom' => fn(Blueprint $t) => $t->string('prenom', 80)->nullable(),
            'telephone' => fn(Blueprint $t) => $t->string('telephone', 30)->nullable(),
            'email' => fn(Blueprint $t) => $t->string('email', 150)->nullable(),
            'profession' => fn(Blueprint $t) => $t->string('profession', 100)->nullable(),
            'date_entree_souhaitee' => fn(Blueprint $t) => $t->date('date_entree_souhaitee')->nullable(),
            'message' => fn(Blueprint $t) => $t->text('message')->nullable(),
            'statut' => fn(Blueprint $t) => $t->string('statut', 20)->default('nouvelle'), // nouvelle | en_cours | acceptee | refusee
            'date_visite' => fn(Blueprint $t) => $t->dateTime('date_visite')->nullable(),
            'note_interne' => fn(Blueprint $t) => $t->text('note_interne')->nullable(),
            'motif_refus' => fn(Blueprint $t) => $t->text('motif_refus')->nullable(),
            'traite_par' => fn(Blueprint $t) => $t->foreignId('traite_par')->nullable()->constrained('users')->nullOnDelete(),
            'ip' => fn(Blueprint $t) => $t->string('ip', 45)->nullable(),
        ]);
        $this->libererEnum('demandes_location', 'statut');
        $this->rendreFacultatives('demandes_location', ['locataire_id', 'user_id', 'nom_complet', 'date_demande']);

        // ---------- MESSAGES DE CONTACT (formulaire « Nous contacter ») ----------
        $this->completer('messages_contact', [
            'nom' => fn(Blueprint $t) => $t->string('nom', 120)->nullable(),
            'email' => fn(Blueprint $t) => $t->string('email', 150)->nullable(),
            'telephone' => fn(Blueprint $t) => $t->string('telephone', 30)->nullable(),
            'sujet' => fn(Blueprint $t) => $t->string('sujet', 150)->nullable(),
            'message' => fn(Blueprint $t) => $t->text('message')->nullable(),
            'lu' => fn(Blueprint $t) => $t->boolean('lu')->default(false),
            'ip' => fn(Blueprint $t) => $t->string('ip', 45)->nullable(),
        ]);
        $this->rendreFacultatives('messages_contact', ['objet', 'contenu', 'nom_complet']);
    }

    public function down(): void
    {
        // Migration de complément : pas de retour arrière destructif.
    }
};