<?php
// FK.market — промокоды и правила наценок (нужны до orders, т.к. orders.promocode_id → promocodes)
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('promocodes', function (Blueprint $t) {
            $t->id();
            $t->string('code', 60)->unique();
            $t->enum('type', ['percent','fixed']);
            $t->decimal('value', 10, 2);
            $t->decimal('min_total', 12, 2)->nullable();
            $t->decimal('max_discount', 12, 2)->nullable();
            $t->unsignedInteger('limit_total')->nullable();
            $t->unsignedInteger('limit_per_user')->nullable();
            $t->unsignedInteger('used_count')->default(0);
            $t->json('category_ids')->nullable();
            $t->json('product_ids')->nullable();
            $t->timestamp('valid_from')->nullable();
            $t->timestamp('valid_until')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->index(['is_active','valid_until']);
        });

        Schema::create('pricing_rules', function (Blueprint $t) {
            $t->id();
            $t->enum('scope', ['global','category','seller','product']);
            $t->unsignedBigInteger('scope_id')->nullable();
            $t->decimal('markup_pct', 5, 2);
            $t->integer('priority')->default(0);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->unique(['scope','scope_id']);
            $t->index(['is_active','priority']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('pricing_rules');
        Schema::dropIfExists('promocodes');
    }
};
