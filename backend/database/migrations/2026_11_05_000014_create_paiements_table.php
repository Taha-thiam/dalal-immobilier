<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('paiements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('echeance_id')->constrained('echeances')->restrictOnDelete();
            $table->foreignId('comptable_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('montant', 12, 2);
            $table->date('date_paiement');
            $table->enum('mode_paiement', ['especes', 'wave', 'orange_money', 'virement']);
            $table->string('reference')->nullable()->unique();
            $table->enum('statut', ['declare', 'enregistre', 'valide', 'annule'])->default('enregistre');
            $table->string('motif_annulation')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('paiements');
    }
};
