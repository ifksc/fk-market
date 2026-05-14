<?php
// FK.market — у каждого payment_method своя интеграция с Freekassa (SCI или API).
// До этой миграции режим был глобальный (settings.freekassa_mode); теперь
// per-method, чтобы можно было настраивать каждый канал отдельно.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('payment_methods', function (Blueprint $t) {
            $t->enum('integration_mode', ['sci', 'api'])->default('sci')->after('fk_id');
        });

        // Если в settings лежал старый freekassa_mode, переносим его как дефолт для всех методов
        $oldMode = DB::table('settings')->where('key', 'freekassa_mode')->value('value');
        if ($oldMode && in_array($oldMode, ['sci', 'api'], true)) {
            DB::table('payment_methods')->update(['integration_mode' => $oldMode]);
        }

        // Глобальная настройка больше не нужна
        DB::table('settings')->where('key', 'freekassa_mode')->delete();
    }

    public function down(): void {
        Schema::table('payment_methods', function (Blueprint $t) {
            $t->dropColumn('integration_mode');
        });
    }
};
