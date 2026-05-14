<?php
// FK.market — каталог + поставщики (важно: providers должны быть созданы до products, т.к. products.provider_id → providers.id)
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('categories', function (Blueprint $t) {
            $t->id();
            $t->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete();
            $t->string('slug', 120)->unique();
            $t->string('name', 180);
            $t->text('description')->nullable();
            $t->string('icon', 40)->nullable();
            $t->integer('sort_order')->default(0);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });

        Schema::create('providers', function (Blueprint $t) {
            $t->id();
            $t->string('code', 60)->unique();
            $t->string('name', 120);
            $t->string('base_url', 255)->nullable();
            $t->text('credentials')->nullable(); // Crypt-encrypted
            $t->json('settings')->nullable();
            $t->boolean('is_enabled')->default(true);
            $t->enum('status', ['ok','degraded','error','disabled'])->default('ok');
            $t->timestamp('last_sync_at')->nullable();
            $t->timestamp('last_error_at')->nullable();
            $t->string('last_error_text', 500)->nullable();
            $t->timestamps();
        });

        Schema::create('products', function (Blueprint $t) {
            $t->id();
            $t->foreignId('seller_id')->constrained('sellers');
            $t->foreignId('category_id')->constrained('categories');
            $t->string('slug', 180)->unique();
            $t->string('name');
            $t->string('short_description', 500)->nullable();
            $t->mediumText('description')->nullable();
            $t->decimal('price_base', 12, 2);
            $t->decimal('markup_pct', 5, 2)->nullable();
            $t->decimal('price_final', 12, 2);
            $t->decimal('price_old', 12, 2)->nullable();
            $t->char('currency', 3)->default('RUB');
            $t->enum('fulfillment_mode', ['stock','api','manual']);
            $t->enum('fulfillment_fallback', ['manual','none'])->default('none');
            $t->foreignId('provider_id')->nullable()->constrained('providers')->nullOnDelete();
            $t->string('provider_external_id', 191)->nullable();
            $t->json('required_params')->nullable();
            $t->enum('status', ['draft','active','archived'])->default('draft');
            $t->decimal('rating', 3, 2)->default(0);
            $t->unsignedInteger('reviews_count')->default(0);
            $t->unsignedInteger('sales_count')->default(0);
            $t->integer('stock_available')->nullable();
            $t->timestamp('published_at')->nullable();
            $t->timestamps();
            $t->index(['category_id','status']);
            $t->index(['seller_id','status']);
            $t->index('status');
            $t->index('price_final');
            $t->index('rating');
            $t->index('fulfillment_mode');
        });

        // FULLTEXT отдельно — Laravel Schema не поддерживает напрямую
        \DB::statement('ALTER TABLE products ADD FULLTEXT INDEX ft_products_search (name, short_description, description)');

        Schema::create('product_images', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_id')->constrained()->cascadeOnDelete();
            $t->string('url', 500);
            $t->string('alt', 255)->nullable();
            $t->integer('sort_order')->default(0);
            $t->boolean('is_primary')->default(false);
            $t->timestamps();
        });

        Schema::create('stock_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_id')->constrained()->cascadeOnDelete();
            $t->text('payload'); // Crypt-encrypted
            $t->string('note', 500)->nullable();
            $t->boolean('is_sold')->default(false);
            $t->unsignedBigInteger('sold_order_id')->nullable();
            $t->timestamp('sold_at')->nullable();
            $t->timestamp('created_at')->nullable()->useCurrent();
            $t->index(['product_id','is_sold']);
            $t->index('sold_order_id');
        });

        Schema::create('provider_products', function (Blueprint $t) {
            $t->id();
            $t->foreignId('provider_id')->constrained()->cascadeOnDelete();
            $t->string('external_id', 191);
            $t->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $t->json('raw_meta')->nullable();
            $t->decimal('price_in', 12, 2)->nullable();
            $t->integer('in_stock')->nullable();
            $t->timestamp('last_seen_at')->nullable();
            $t->timestamps();
            $t->unique(['provider_id','external_id']);
        });

        Schema::create('provider_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('provider_id')->constrained()->cascadeOnDelete();
            $t->string('operation', 60);
            $t->mediumText('request')->nullable();
            $t->mediumText('response')->nullable();
            $t->smallInteger('status_code')->nullable();
            $t->boolean('success')->default(false);
            $t->integer('latency_ms')->nullable();
            $t->string('error_text', 500)->nullable();
            $t->unsignedBigInteger('related_order_id')->nullable()->index();
            $t->timestamp('created_at')->nullable()->useCurrent();
            $t->index(['provider_id','created_at']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('provider_logs');
        Schema::dropIfExists('provider_products');
        Schema::dropIfExists('stock_items');
        Schema::dropIfExists('product_images');
        Schema::dropIfExists('products');
        Schema::dropIfExists('providers');
        Schema::dropIfExists('categories');
    }
};
