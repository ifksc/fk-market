<?php
// FK.market — флаг "Product был скрыт автосинком".
// Когда у Product исчезают ВСЕ варианты у поставщика, мы переводим его в draft
// и ставим auto_hidden_at = now(). Когда вариант возвращается — восстанавливаем
// в active по auto_hidden_at. Если admin сам выставил draft (auto_hidden_at = NULL),
// автосинк его не трогает.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('products', function (Blueprint $t) {
            $t->timestamp('auto_hidden_at')->nullable()->after('published_at');
        });
    }

    public function down(): void {
        Schema::table('products', function (Blueprint $t) {
            $t->dropColumn('auto_hidden_at');
        });
    }
};
