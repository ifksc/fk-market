<?php
// FK.market — настройка режима интеграции с Freekassa: 'sci' (форма) или 'api' (REST).
// Хранится в settings (управляется через /admin/settings).
//
// Эта миграция сохраняет старое имя файла (fkwallet_mode) на случай, если успела
// накатиться до переименования. Внутри — кейс «было fkwallet_mode → стало
// freekassa_mode» и идемпотентная вставка.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void {
        // Если старая запись успела появиться — переименуем её
        DB::table('settings')->where('key', 'fkwallet_mode')->update(['key' => 'freekassa_mode']);

        DB::table('settings')->updateOrInsert(
            ['key' => 'freekassa_mode'],
            [
                'value' => 'sci',
                'type' => 'string',
                'description' => 'Режим интеграции с Freekassa: sci (форма) или api (REST)',
            ],
        );
    }

    public function down(): void {
        DB::table('settings')->where('key', 'freekassa_mode')->delete();
    }
};
