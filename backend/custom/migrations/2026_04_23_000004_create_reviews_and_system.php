<?php
// FK.market — отзывы, настройки, аудит
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('reviews', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('order_id')->constrained()->cascadeOnDelete();
            $t->unsignedTinyInteger('rating');
            $t->text('text')->nullable();
            $t->boolean('is_approved')->default(true);
            $t->timestamps();
            $t->unique(['product_id','user_id','order_id']);
            $t->index(['product_id','is_approved']);
        });

        Schema::create('settings', function (Blueprint $t) {
            $t->string('key', 120)->primary();
            $t->text('value')->nullable();
            $t->enum('type', ['string','int','bool','json'])->default('string');
            $t->string('description', 500)->nullable();
            $t->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });

        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->string('action', 120);
            $t->string('subject_type', 60)->nullable();
            $t->unsignedBigInteger('subject_id')->nullable();
            $t->json('payload')->nullable();
            $t->string('ip', 45)->nullable();
            $t->string('user_agent', 500)->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->index(['subject_type','subject_id']);
            $t->index('action');
        });
    }

    public function down(): void {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('settings');
        Schema::dropIfExists('reviews');
    }
};
