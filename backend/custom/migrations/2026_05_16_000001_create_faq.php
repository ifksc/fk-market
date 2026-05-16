<?php
// FK.market — частые вопросы (общий FAQ + привязка вопросов к товарам).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('faq_items', function (Blueprint $t) {
            $t->id();
            $t->string('question', 300);
            $t->text('answer');
            $t->string('category', 80)->nullable(); // раздел общего FAQ
            $t->boolean('is_general')->default(true); // показывать в /faq
            $t->integer('sort')->default(100);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->index(['is_general', 'is_active']);
        });

        // Привязка вопросов к товарам (many-to-many).
        Schema::create('faq_item_product', function (Blueprint $t) {
            $t->id();
            $t->foreignId('faq_item_id')->constrained('faq_items')->cascadeOnDelete();
            $t->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $t->unique(['faq_item_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('faq_item_product');
        Schema::dropIfExists('faq_items');
    }
};
