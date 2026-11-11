<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interventions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('signalement_id')->unique()->constrained('signalements')->cascadeOnDelete();
            $table->foreignId('gestionnaire_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('prestataire_nom');
            $table->string('prestataire_telephone')->nullable();
            $table->text('description')->nullable();
            $table->date('date_intervention');
            $table->decimal('cout', 12, 2)->default(0);
            $table->string('facture_url')->nullable();
            $table->enum('statut_paiement', ['a_payer', 'validee', 'payee'])->default('a_payer');
            $table->boolean('imputee_proprietaire')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interventions');
    }
};
