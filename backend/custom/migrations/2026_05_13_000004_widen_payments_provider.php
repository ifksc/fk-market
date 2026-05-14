<?php
// FK.market — payments.provider был ENUM с фиксированным набором; чтобы добавлять
// новые источники (freekassa и т.п.) без миграций — делаем колонку VARCHAR.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void {
        DB::statement("ALTER TABLE payments MODIFY COLUMN provider VARCHAR(60) NOT NULL");
        // Перенесём все старые 'fkwallet' → 'freekassa', чтобы не оставлять путаницы
        DB::table('payments')->where('provider', 'fkwallet')->update(['provider' => 'freekassa']);
    }

    public function down(): void {
        // Обратно в enum — не очень осмысленно; оставим VARCHAR.
    }
};
