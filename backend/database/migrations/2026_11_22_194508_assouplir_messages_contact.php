<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Toutes les colonnes obligatoires de messages_contact (sauf id) deviennent facultatives
        $colonnes = DB::select("
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'messages_contact' AND is_nullable = 'NO' AND column_name <> 'id'
        ");

        foreach ($colonnes as $c) {
            DB::statement("ALTER TABLE messages_contact ALTER COLUMN \"{$c->column_name}\" DROP NOT NULL");
        }
    }

    public function down(): void {}
};