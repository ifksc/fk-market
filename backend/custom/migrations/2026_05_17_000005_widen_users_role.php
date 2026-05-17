<?php
// FK.market — users.role был ENUM('customer','admin','seller','moderator');
// роль 'journalist' (модуль блога) в него не входила → MySQL обрезал значение
// при сохранении («Data truncated for column 'role'»). Делаем колонку VARCHAR,
// чтобы добавлять роли без миграций — как раньше с payments.provider.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN role VARCHAR(20) NOT NULL DEFAULT 'customer'");
    }

    public function down(): void
    {
        // Обратно в enum не возвращаем — VARCHAR гибче.
    }
};
