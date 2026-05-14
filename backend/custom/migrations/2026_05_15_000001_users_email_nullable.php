<?php
// FK.market — делаем users.email nullable, чтобы можно было регистрировать
// пользователей через Telegram OAuth (Telegram не отдаёт email).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void {
        // Меняем тип через сырой SQL: doctrine/dbal в Laravel 11 опционален,
        // а нам нужно ровно nullable VARCHAR с тем же UNIQUE индексом.
        DB::statement('ALTER TABLE users MODIFY COLUMN email VARCHAR(190) NULL');
    }

    public function down(): void {
        DB::statement('ALTER TABLE users MODIFY COLUMN email VARCHAR(190) NOT NULL');
    }
};
