<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('biens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('proprietaire_id')->constrained('proprietaires')->restrictOnDelete();
            $table->string('reference')->unique();
            $table->string('type');              // appartement, villa, studio, bureau, magasin
            $table->string('titre');
            $table->string('quartier');
            $table->string('adresse');
            $table->decimal('surface', 8, 2)->nullable();
            $table->unsignedSmallInteger('nb_pieces')->nullable();
            $table->decimal('loyer_propose', 12, 2);
            $table->decimal('caution', 12, 2)->default(0);
            $table->text('description')->nullable();
            $table->decimal('taux_commission', 5, 2)->default(10);
            $table->enum('statut', ['libre', 'loue', 'archive'])->default('libre');
            $table->boolean('publie')->default(false);
            $table->timestamps();
            $table->index(['statut', 'publie']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('biens');
    }
};
