<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('baux', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bien_id')->constrained('biens')->restrictOnDelete();
            $table->foreignId('locataire_id')->constrained('locataires')->restrictOnDelete();
            $table->foreignId('gestionnaire_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('bail_precedent_id')->nullable()->constrained('baux')->nullOnDelete(); // renouvellement
            $table->string('numero')->unique();
            $table->enum('type_bail', ['habitation', 'professionnel'])->default('habitation');
            $table->date('date_debut');
            $table->date('date_fin');
            $table->decimal('loyer_mensuel', 12, 2);
            $table->decimal('charges', 12, 2)->default(0);
            $table->decimal('avance', 12, 2)->default(0);
            $table->unsignedTinyInteger('jour_echeance')->default(5);
            $table->boolean('renouvellement_tacite')->default(true);
            $table->unsignedTinyInteger('preavis_mois')->default(1);
            $table->text('clauses')->nullable();
            $table->enum('statut', ['actif', 'resilie', 'termine'])->default('actif');
            $table->timestamps();
            $table->index(['bien_id', 'statut']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('baux');
    }
};
