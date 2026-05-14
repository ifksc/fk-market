<?php
// FK.market — добавляем колонку для счётчика создаваемых при автосинке Product'ов.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('provider_sync_runs', function (Blueprint $t) {
            if (!Schema::hasColumn('provider_sync_runs', 'products_connected')) {
                $t->unsignedInteger('products_connected')->default(0)->after('products_stale');
            }
        });
    }

    public function down(): void {
        Schema::table('provider_sync_runs', function (Blueprint $t) {
            if (Schema::hasColumn('provider_sync_runs', 'products_connected')) {
                $t->dropColumn('products_connected');
            }
        });
    }
};
