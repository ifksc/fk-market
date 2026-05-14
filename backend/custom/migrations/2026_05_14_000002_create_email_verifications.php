<?php
// FK.market — токены для подтверждения email.
// users.email_verified_at — флаг состояния.
// email_verifications — одноразовые ссылки (создание / смена email).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('email_verifications', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('token', 64)->unique();
            // Если NULL — подтверждение текущего email пользователя.
            // Если задан — пользователь хочет сменить email на этот.
            $t->string('new_email', 190)->nullable();
            $t->timestamp('expires_at');
            $t->timestamp('used_at')->nullable();
            $t->timestamps();
            $t->index(['user_id', 'used_at']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('email_verifications');
    }
};
