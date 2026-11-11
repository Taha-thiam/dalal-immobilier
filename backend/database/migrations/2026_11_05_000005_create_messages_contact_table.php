<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages_contact', function (Blueprint $table) {
            $table->id();
            $table->foreignId('proprietaire_id')->nullable()->constrained('proprietaires')->nullOnDelete();
            $table->string('nom_expediteur');
            $table->string('email');
            $table->string('telephone')->nullable();
            $table->string('objet');
            $table->text('contenu');
            $table->boolean('lu')->default(false);
            $table->timestamp('date_envoi')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages_contact');
    }
};
