<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('journal_activites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');            // ex. creation, modification, validation, annulation
            $table->string('entite');            // ex. Bail, Paiement
            $table->unsignedBigInteger('entite_id')->nullable();
            $table->text('details')->nullable();
            $table->timestamp('date_heure')->useCurrent();
            $table->index(['entite', 'entite_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_activites');
    }
};
