<?php
// FK.market — заказы, позиции, платежи, выплаты, очередь выдачи
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('orders', function (Blueprint $t) {
            $t->id();
            $t->string('public_number', 32)->unique();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('email', 190);
            $t->string('phone', 32)->nullable();
            $t->char('currency', 3)->default('RUB');
            $t->decimal('subtotal', 12, 2);
            $t->decimal('discount', 12, 2)->default(0);
            $t->decimal('total', 12, 2);
            $t->foreignId('promocode_id')->nullable()->constrained('promocodes')->nullOnDelete();
            $t->enum('status', ['pending','paid','fulfilling','completed','failed','refunded','cancelled'])->default('pending');
            $t->unsignedBigInteger('payment_id')->nullable();
            $t->json('utm')->nullable();
            $t->string('ip', 45)->nullable();
            $t->string('user_agent', 500)->nullable();
            $t->timestamp('paid_at')->nullable();
            $t->timestamp('completed_at')->nullable();
            $t->timestamps();
            $t->index('status');
            $t->index('created_at');
        });

        Schema::create('order_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('order_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->constrained();
            $t->foreignId('seller_id')->constrained('sellers');
            $t->unsignedInteger('qty')->default(1);
            $t->decimal('price', 12, 2);
            $t->decimal('price_in', 12, 2)->nullable();
            $t->decimal('total', 12, 2);
            $t->json('params')->nullable();
            $t->foreignId('stock_item_id')->nullable()->constrained('stock_items')->nullOnDelete();
            $t->string('provider_order_id', 191)->nullable();
            $t->enum('fulfillment_status', ['pending','queued','in_progress','delivered','failed'])->default('pending');
            $t->text('delivered_payload')->nullable(); // Crypt-encrypted
            $t->timestamp('delivered_at')->nullable();
            $t->timestamps();
            $t->index('fulfillment_status');
        });

        Schema::create('payments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('order_id')->constrained()->cascadeOnDelete();
            $t->enum('provider', ['fkwallet','fkwallet_wallet','balance','manual'])->default('fkwallet');
            $t->string('method', 40)->nullable();
            $t->string('provider_payment_id', 191)->nullable();
            $t->decimal('amount', 12, 2);
            $t->char('currency', 3)->default('RUB');
            $t->enum('status', ['pending','authorized','paid','failed','refunded','cancelled'])->default('pending');
            $t->string('redirect_url', 500)->nullable();
            $t->json('raw_request')->nullable();
            $t->json('raw_response')->nullable();
            $t->timestamp('paid_at')->nullable();
            $t->string('failed_reason', 500)->nullable();
            $t->timestamps();
            $t->index('status');
            $t->index(['provider','provider_payment_id']);
        });

        Schema::create('payouts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('seller_id')->constrained()->cascadeOnDelete();
            $t->decimal('amount', 12, 2);
            $t->char('currency', 3)->default('RUB');
            $t->enum('provider', ['fkwallet_payout','manual'])->default('fkwallet_payout');
            $t->string('method', 40)->nullable();
            $t->string('destination', 191)->nullable();
            $t->string('provider_payout_id', 191)->nullable();
            $t->enum('status', ['requested','processing','paid','failed','cancelled'])->default('requested');
            $t->json('raw_response')->nullable();
            $t->timestamp('processed_at')->nullable();
            $t->timestamps();
            $t->index('status');
        });

        Schema::create('fulfillment_tasks', function (Blueprint $t) {
            $t->id();
            $t->foreignId('order_item_id')->unique()->constrained()->cascadeOnDelete();
            $t->enum('mode', ['api','manual']);
            $t->foreignId('provider_id')->nullable()->constrained('providers')->nullOnDelete();
            $t->enum('status', ['queued','in_progress','done','failed','cancelled'])->default('queued');
            $t->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $t->json('input_params')->nullable();
            $t->json('result')->nullable();
            $t->unsignedInteger('retries')->default(0);
            $t->string('error_text', 500)->nullable();
            $t->timestamp('deadline_at')->nullable();
            $t->timestamp('started_at')->nullable();
            $t->timestamp('finished_at')->nullable();
            $t->timestamps();
            $t->index('status');
            $t->index('deadline_at');
        });
    }

    public function down(): void {
        Schema::dropIfExists('fulfillment_tasks');
        Schema::dropIfExists('payouts');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
