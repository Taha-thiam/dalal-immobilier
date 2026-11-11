<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reversements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('proprietaire_id')->constrained('proprietaires')->restrictOnDelete();
            $table->foreignId('comptable_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('periode');             // 1er jour du mois concerne
            $table->decimal('total_loyers', 12, 2)->default(0);
            $table->decimal('commission', 12, 2)->default(0);
            $table->decimal('frais_interventions', 12, 2)->default(0);
            $table->decimal('montant_net', 12, 2)->default(0);
            $table->date('date_reversement')->nullable();
            $table->enum('statut', ['calcule', 'effectue'])->default('calcule');
            $table->string('releve_url')->nullable();
            $table->timestamps();
            $table->unique(['proprietaire_id', 'periode']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reversements');
    }
};
