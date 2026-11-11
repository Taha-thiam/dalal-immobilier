<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Colonnes nécessaires au suivi d'une caution (entrée -> sortie). */
    private function colonnes(): array
    {
        return [
            'montant'                => fn (Blueprint $t) => $t->decimal('montant', 12, 2)->default(0),
            'date_encaissement'      => fn (Blueprint $t) => $t->date('date_encaissement')->nullable(),
            'mode_encaissement'      => fn (Blueprint $t) => $t->string('mode_encaissement', 30)->nullable(),
            'reference_encaissement' => fn (Blueprint $t) => $t->string('reference_encaissement', 100)->nullable(),
            'montant_retenu'         => fn (Blueprint $t) => $t->decimal('montant_retenu', 12, 2)->default(0),
            'motif_retenue'          => fn (Blueprint $t) => $t->text('motif_retenue')->nullable(),
            'montant_rembourse'      => fn (Blueprint $t) => $t->decimal('montant_rembourse', 12, 2)->nullable(),
            'date_remboursement'     => fn (Blueprint $t) => $t->date('date_remboursement')->nullable(),
            'mode_remboursement'     => fn (Blueprint $t) => $t->string('mode_remboursement', 30)->nullable(),
            'encaisse_par'           => fn (Blueprint $t) => $t->foreignId('encaisse_par')->nullable()->constrained('users')->nullOnDelete(),
            'rembourse_par'          => fn (Blueprint $t) => $t->foreignId('rembourse_par')->nullable()->constrained('users')->nullOnDelete(),
        ];
    }

    public function up(): void
    {
        foreach ($this->colonnes() as $nom => $definition) {
            if (! Schema::hasColumn('cautions', $nom)) {
                Schema::table('cautions', fn (Blueprint $t) => $definition($t));
            }
        }

        // La colonne « statut » était peut-être un enum limité :
        // on retire la contrainte PostgreSQL pour accepter les nouveaux statuts
        // (a_encaisser, encaissee, restituee). Le service contrôle les valeurs.
        if (Schema::hasColumn('cautions', 'statut')) {
            DB::statement('ALTER TABLE cautions DROP CONSTRAINT IF EXISTS cautions_statut_check');
        } else {
            Schema::table('cautions', fn (Blueprint $t) => $t->string('statut', 20)->default('a_encaisser'));
        }
    }

    public function down(): void
    {
        foreach (['encaisse_par', 'rembourse_par'] as $fk) {
            if (Schema::hasColumn('cautions', $fk)) {
                Schema::table('cautions', fn (Blueprint $t) => $t->dropConstrainedForeignId($fk));
            }
        }
        foreach (['date_encaissement', 'mode_encaissement', 'reference_encaissement', 'montant_retenu',
                  'motif_retenue', 'montant_rembourse', 'date_remboursement', 'mode_remboursement'] as $col) {
            if (Schema::hasColumn('cautions', $col)) {
                Schema::table('cautions', fn (Blueprint $t) => $t->dropColumn($col));
            }
        }
    }
};