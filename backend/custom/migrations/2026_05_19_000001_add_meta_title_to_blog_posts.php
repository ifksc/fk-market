<?php
// FK.market — отдельный SEO-заголовок статьи блога.
// title статьи = H1 на странице; meta_title = <title> в выдаче.
// Пусто → в <title> используется обычный title.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('blog_posts', function (Blueprint $t) {
            $t->string('meta_title', 70)->nullable()->after('title');
        });
    }

    public function down(): void
    {
        Schema::table('blog_posts', function (Blueprint $t) {
            $t->dropColumn('meta_title');
        });
    }
};
