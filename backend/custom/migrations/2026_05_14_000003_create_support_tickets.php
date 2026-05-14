<?php
// FK.market — обращения покупателя по заказу (замена кода, неверный товар и т.п.).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('support_tickets', function (Blueprint $t) {
            $t->id();
            // user_id может быть NULL, если гость открыл тикет по public_number + email.
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $t->foreignId('order_item_id')->nullable()->constrained('order_items')->nullOnDelete();
            $t->enum('kind', ['code_not_working', 'wrong_item', 'other'])->default('other');
            $t->string('subject', 200);
            $t->text('body');
            $t->enum('status', ['open', 'in_progress', 'resolved', 'rejected'])->default('open');
            $t->text('admin_note')->nullable();
            $t->timestamp('resolved_at')->nullable();
            $t->timestamps();
            $t->index('status');
            $t->index('user_id');
        });
    }

    public function down(): void {
        Schema::dropIfExists('support_tickets');
    }
};
