<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('photos_biens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bien_id')->constrained('biens')->cascadeOnDelete();
            $table->string('url');
            $table->unsignedSmallInteger('ordre')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('photos_biens');
    }
};
