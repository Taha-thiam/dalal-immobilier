<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function colonnes(): array
    {
        return [
            'numero'          => fn (Blueprint $t) => $t->string('numero', 30)->nullable()->unique(),
            'proprietaire_id' => fn (Blueprint $t) => $t->foreignId('proprietaire_id')->nullable()->constrained('proprietaires')->restrictOnDelete(),
            'periode_debut'   => fn (Blueprint $t) => $t->date('periode_debut')->nullable(),
            'periode_fin'     => fn (Blueprint $t) => $t->date('periode_fin')->nullable(),
            'montant_brut'    => fn (Blueprint $t) => $t->decimal('montant_brut', 12, 2)->default(0),
            'commission'      => fn (Blueprint $t) => $t->decimal('commission', 12, 2)->default(0),
            'montant_net'     => fn (Blueprint $t) => $t->decimal('montant_net', 12, 2)->default(0),
            'date_paiement'   => fn (Blueprint $t) => $t->date('date_paiement')->nullable(),
            'mode_paiement'   => fn (Blueprint $t) => $t->string('mode_paiement', 30)->nullable(),
            'reference'       => fn (Blueprint $t) => $t->string('reference', 100)->nullable(),
            'releve_path'     => fn (Blueprint $t) => $t->string('releve_path')->nullable(),
            'cree_par'        => fn (Blueprint $t) => $t->foreignId('cree_par')->nullable()->constrained('users')->nullOnDelete(),
            'paye_par'        => fn (Blueprint $t) => $t->foreignId('paye_par')->nullable()->constrained('users')->nullOnDelete(),
        ];
    }

    public function up(): void
    {
        foreach ($this->colonnes() as $nom => $definition) {
            if (! Schema::hasColumn('reversements', $nom)) {
                Schema::table('reversements', fn (Blueprint $t) => $definition($t));
            }
        }

        // Statuts : a_payer -> paye
        if (Schema::hasColumn('reversements', 'statut')) {
            DB::statement('ALTER TABLE reversements DROP CONSTRAINT IF EXISTS reversements_statut_check');
        } else {
            Schema::table('reversements', fn (Blueprint $t) => $t->string('statut', 20)->default('a_payer'));
        }

        // Le « tampon » : chaque paiement validé est reversé une seule fois
        if (! Schema::hasColumn('paiements', 'reversement_id')) {
            Schema::table('paiements', fn (Blueprint $t) => $t->foreignId('reversement_id')->nullable()->constrained('reversements')->nullOnDelete());
        }

        // Les anciennes colonnes NOT NULL que je ne connais pas ne doivent pas bloquer l'insertion
        foreach (['mois', 'montant', 'periode', 'bien_id', 'bail_id'] as $ancienne) {
            if (Schema::hasColumn('reversements', $ancienne)) {
                DB::statement("ALTER TABLE reversements ALTER COLUMN {$ancienne} DROP NOT NULL");
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('paiements', 'reversement_id')) {
            Schema::table('paiements', fn (Blueprint $t) => $t->dropConstrainedForeignId('reversement_id'));
        }
    }
};