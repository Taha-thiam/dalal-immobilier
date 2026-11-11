<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('demandes_location', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bien_id')->constrained('biens')->cascadeOnDelete();
            $table->foreignId('gestionnaire_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('locataire_id')->nullable()->constrained('locataires')->nullOnDelete(); // rempli après conversion
            $table->string('numero')->unique();
            $table->string('nom');
            $table->string('telephone');
            $table->string('email');
            $table->string('profession')->nullable();
            $table->date('date_entree_souhaitee')->nullable();
            $table->text('message')->nullable();
            $table->enum('statut', ['nouvelle', 'en_cours', 'acceptee', 'refusee'])->default('nouvelle');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('demandes_location');
    }
};
