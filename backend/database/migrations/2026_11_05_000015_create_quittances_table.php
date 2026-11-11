<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quittances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('paiement_id')->unique()->constrained('paiements')->cascadeOnDelete();
            $table->string('numero')->unique();
            $table->date('date_emission');
            $table->string('fichier_url')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quittances');
    }
};
