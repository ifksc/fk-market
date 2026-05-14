<?php
// FK.market — категории могут нести картинку (особенно импортированные от провайдеров).
// Добавляем categories.image_url, чтобы на витрине можно было показывать обложку категории
// вместо генерируемого градиента.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('categories', function (Blueprint $t) {
            $t->string('image_url', 500)->nullable()->after('icon');
        });
    }

    public function down(): void {
        Schema::table('categories', function (Blueprint $t) {
            $t->dropColumn('image_url');
        });
    }
};
