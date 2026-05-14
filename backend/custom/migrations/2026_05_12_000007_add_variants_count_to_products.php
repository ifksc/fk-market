<?php
// FK.market — счётчик внутренних вариантов товара (для variant_select).
// Используется в гриде категорий: если у группового Product 14 регионов,
// то в категорию он засчитается как 14 «товаров», а не 1.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('products', function (Blueprint $t) {
            $t->unsignedInteger('variants_count')->default(1)->after('stock_available');
        });
    }

    public function down(): void {
        Schema::table('products', function (Blueprint $t) {
            $t->dropColumn('variants_count');
        });
    }
};
