<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cautions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bail_id')->unique()->constrained('baux')->cascadeOnDelete();
            $table->decimal('montant', 12, 2);
            $table->date('date_encaissement')->nullable();
            $table->decimal('montant_retenu', 12, 2)->default(0);
            $table->decimal('montant_rembourse', 12, 2)->default(0);
            $table->date('date_remboursement')->nullable();
            $table->enum('statut', ['a_encaisser', 'encaissee', 'remboursee'])->default('a_encaisser');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cautions');
    }
};
