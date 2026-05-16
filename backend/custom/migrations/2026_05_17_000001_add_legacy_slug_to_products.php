<?php
// FK.market — колонка legacy_slug для 301-редиректа со старых URL товаров.
// При переходе на читаемые slug'и старый slug сохраняется здесь, и
// Product::resolveRouteBinding продолжает находить товар по нему.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('products', function (Blueprint $t) {
            $t->string('legacy_slug', 180)->nullable()->index()->after('slug');
        });
    }

    public function down(): void {
        // Перед удалением колонки возвращаем исходные slug, чтобы откат не оставил
        // товары с новыми URL и без карты редиректов.
        DB::table('products')
            ->whereNotNull('legacy_slug')
            ->update(['slug' => DB::raw('legacy_slug')]);

        Schema::table('products', function (Blueprint $t) {
            $t->dropColumn('legacy_slug');
        });
    }
};
