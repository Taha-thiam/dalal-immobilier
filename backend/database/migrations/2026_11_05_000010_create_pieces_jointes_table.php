<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pieces_jointes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bail_id')->constrained('baux')->cascadeOnDelete();
            $table->enum('type', ['contrat_genere', 'contrat_signe', 'cni', 'autre']);
            $table->string('fichier_url');
            $table->unsignedSmallInteger('version')->default(1);
            $table->timestamp('date_ajout')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pieces_jointes');
    }
};
