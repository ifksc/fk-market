<?php
// FK.market — блог: SEO-статьи для органического трафика.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('blog_posts', function (Blueprint $t) {
            $t->id();
            $t->string('slug')->unique();
            $t->string('title');
            $t->string('meta_description', 255)->nullable();
            $t->string('excerpt', 300)->nullable();        // краткое описание для карточки
            $t->longText('content')->nullable();           // контент в Markdown
            $t->string('cover_image', 500)->nullable();    // обложка 1200×630
            $t->string('author', 120)->nullable();
            $t->json('tags')->nullable();                  // string[]
            $t->json('related_products')->nullable();      // slug[] товаров для CTA
            $t->json('related_posts')->nullable();         // slug[] связанных статей
            $t->json('faq')->nullable();                   // [{question, answer}]
            $t->string('status', 20)->default('draft');    // draft | published
            $t->timestamp('published_at')->nullable();
            // Telegram-публикация (Фаза 5) — колонки заводим сразу.
            $t->timestamp('telegram_posted_at')->nullable();
            $t->unsignedBigInteger('telegram_message_id')->nullable();
            $t->timestamps();
            $t->index(['status', 'published_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blog_posts');
    }
};
