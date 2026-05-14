<?php
// FK.market — связать categories с поставщиками (для зеркалирования дерева FKwallet).
// После миграции в categories появляются поля:
//   provider_id            — NULL для наших категорий, ID провайдера для импортированных
//   provider_external_id   — id категории в системе провайдера (для FK — это online category id)
// + unique индекс (provider_id, provider_external_id) — для безопасного upsert.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('categories', function (Blueprint $t) {
            $t->foreignId('provider_id')->nullable()->after('parent_id')
                ->constrained('providers')->nullOnDelete();
            $t->string('provider_external_id', 191)->nullable()->after('provider_id');
            $t->unique(['provider_id', 'provider_external_id'], 'categories_provider_external_unique');
        });
    }

    public function down(): void {
        Schema::table('categories', function (Blueprint $t) {
            $t->dropUnique('categories_provider_external_unique');
            $t->dropConstrainedForeignId('provider_id');
            $t->dropColumn('provider_external_id');
        });
    }
};
