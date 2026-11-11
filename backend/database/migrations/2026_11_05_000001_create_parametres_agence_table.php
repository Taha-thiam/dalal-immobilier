<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parametres_agence', function (Blueprint $table) {
            $table->id();
            $table->string('nom_agence');
            $table->string('adresse')->nullable();
            $table->string('telephone')->nullable();
            $table->string('logo_url')->nullable();
            $table->decimal('taux_commission_defaut', 5, 2)->default(10);
            $table->text('modele_contrat')->nullable();
            $table->text('modele_quittance')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parametres_agence');
    }
};
