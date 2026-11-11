<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('signalements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bien_id')->constrained('biens')->cascadeOnDelete();
            $table->foreignId('locataire_id')->constrained('locataires')->cascadeOnDelete();
            $table->string('numero')->unique();
            $table->string('categorie');         // plomberie, electricite, serrurerie...
            $table->enum('urgence', ['basse', 'moyenne', 'haute'])->default('moyenne');
            $table->text('description');
            $table->string('photo_url')->nullable();
            $table->enum('statut', ['ouvert', 'en_cours', 'resolu', 'cloture'])->default('ouvert');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('signalements');
    }
};
