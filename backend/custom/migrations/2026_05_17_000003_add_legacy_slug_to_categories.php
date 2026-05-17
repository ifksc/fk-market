<?php
// FK.market — колонка legacy_slug для 301-редиректа со старых URL категорий.
// При переходе на читаемые slug'и старый slug (вида fk-11) сохраняется здесь,
// и фронт делает 301 со старого URL категории на новый.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('categories', function (Blueprint $t) {
            $t->string('legacy_slug', 120)->nullable()->index()->after('slug');
        });
    }

    public function down(): void {
        // Перед удалением колонки возвращаем исходные slug.
        DB::table('categories')
            ->whereNotNull('legacy_slug')
            ->update(['slug' => DB::raw('legacy_slug')]);

        Schema::table('categories', function (Blueprint $t) {
            $t->dropColumn('legacy_slug');
        });
    }
};
