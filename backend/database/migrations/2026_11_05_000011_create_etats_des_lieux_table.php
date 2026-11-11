<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etats_des_lieux', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bail_id')->unique()->constrained('baux')->cascadeOnDelete();
            $table->enum('type', ['sortie'])->default('sortie');
            $table->date('date');
            $table->unsignedInteger('releve_electricite')->nullable();
            $table->unsignedInteger('releve_eau')->nullable();
            $table->unsignedSmallInteger('cles_rendues')->default(0);
            $table->string('signature_url')->nullable();
            $table->decimal('montant_retenu', 12, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etats_des_lieux');
    }
};
