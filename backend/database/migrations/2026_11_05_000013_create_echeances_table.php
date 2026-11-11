<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('echeances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bail_id')->constrained('baux')->cascadeOnDelete();
            $table->date('mois');                // 1er jour du mois concerne
            $table->decimal('montant_du', 12, 2);
            $table->date('date_limite');
            $table->decimal('reste_du', 12, 2);
            $table->enum('statut', ['impayee', 'partielle', 'payee'])->default('impayee');
            $table->timestamps();
            $table->unique(['bail_id', 'mois']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('echeances');
    }
};
