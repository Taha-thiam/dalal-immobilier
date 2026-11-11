<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('elements_edl', function (Blueprint $table) {
            $table->id();
            $table->foreignId('etat_des_lieux_id')->constrained('etats_des_lieux')->cascadeOnDelete();
            $table->string('piece');             // salon, cuisine...
            $table->string('element');           // murs, fenetre...
            $table->enum('etat', ['bon', 'use', 'degrade']);
            $table->string('commentaire')->nullable();
            $table->string('photo_url')->nullable();
            $table->decimal('cout', 12, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('elements_edl');
    }
};
