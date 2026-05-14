<?php
// FK.market — категории, которые попадают в верхнее меню сайта.
// Админ управляет этим флагом через /admin/categories/{id} — чекбоксом.
// При первом накате флаг включаем у текущих ai/vpn/skins/keys/subs,
// чтобы шапка осталась как была.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('categories', function (Blueprint $t) {
            $t->boolean('show_in_header')->default(false)->after('sort_order');
        });

        DB::table('categories')
            ->whereIn('slug', ['ai', 'vpn', 'skins', 'keys', 'subs'])
            ->update(['show_in_header' => true]);
    }

    public function down(): void {
        Schema::table('categories', function (Blueprint $t) {
            $t->dropColumn('show_in_header');
        });
    }
};
