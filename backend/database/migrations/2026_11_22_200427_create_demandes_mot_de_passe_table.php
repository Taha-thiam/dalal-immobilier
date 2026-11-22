<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('demandes_mot_de_passe', function (Blueprint $t) {
            $t->id();
            $t->string('email', 150);
            $t->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $t->string('statut', 20)->default('en_attente'); // en_attente | traitee | rejetee
            $t->foreignId('traite_par')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('traite_le')->nullable();
            $t->string('ip', 45)->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('demandes_mot_de_passe');
    }
};