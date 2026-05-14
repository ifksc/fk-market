<?php
// FK.market — настраиваемые способы оплаты на чекауте.
// Админ управляет видимостью, сортировкой и параметрами каждого метода
// (банковская карта, СБП, FKwallet-кошелёк, крипта, и потом — что добавится).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('payment_methods', function (Blueprint $t) {
            $t->id();
            $t->string('code', 40)->unique();      // 'card', 'sbp', 'wallet', 'crypto'…
            $t->string('name', 120);                // Видимое название («Банковская карта»)
            $t->string('description', 255)->nullable(); // Подпись под названием
            $t->string('icon', 40)->nullable();    // Lucide-имя
            $t->integer('fk_id')->nullable();      // ID метода в FK API (i={n})
            $t->boolean('is_enabled')->default(true);
            $t->integer('sort_order')->default(100);
            $t->decimal('min_amount', 12, 2)->nullable();
            $t->decimal('max_amount', 12, 2)->nullable();
            $t->decimal('extra_fee_pct', 5, 2)->default(0); // Доп. наша комиссия за этот метод
            $t->json('config')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('payment_methods');
    }
};
