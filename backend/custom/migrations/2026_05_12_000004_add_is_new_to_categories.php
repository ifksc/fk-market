<?php
// FK.market — бейдж NEW для категорий: админ ставит флажок, и категория
// получает плашку в шапке сайта и на главной (грид категорий).
// При накате включаем для slug=ai, чтобы текущий вид сохранился.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('categories', function (Blueprint $t) {
            $t->boolean('is_new')->default(false)->after('show_in_header');
        });

        DB::table('categories')->where('slug', 'ai')->update(['is_new' => true]);
    }

    public function down(): void {
        Schema::table('categories', function (Blueprint $t) {
            $t->dropColumn('is_new');
        });
    }
};
