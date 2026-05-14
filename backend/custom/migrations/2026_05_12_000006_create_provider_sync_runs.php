<?php
// FK.market — история запусков синхронизации каталога поставщика.
// Каждый запуск артизан-команды providers:sync пишет сюда строку с временем,
// статусом и счётчиками. В админке это покажет, что cron работает,
// сколько товаров затронуто и были ли ошибки.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('provider_sync_runs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('provider_id')->constrained()->cascadeOnDelete();
            $t->enum('trigger', ['cron', 'manual', 'api'])->default('manual');
            $t->enum('status', ['running', 'ok', 'error'])->default('running');
            $t->timestamp('started_at');
            $t->timestamp('finished_at')->nullable();
            $t->integer('categories_synced')->default(0);
            $t->integer('products_added')->default(0);
            $t->integer('products_updated')->default(0);
            $t->integer('products_stale')->default(0);
            $t->integer('refresh_updated')->default(0);
            $t->integer('refresh_hidden')->default(0);
            $t->integer('refresh_restored')->default(0);
            $t->integer('refresh_variants_removed')->default(0);
            $t->string('error_text', 1000)->nullable();
            $t->index(['provider_id', 'started_at']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('provider_sync_runs');
    }
};
