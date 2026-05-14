<?php
// FK.market — users, password_reset_tokens, sessions (заменяет дефолтную миграцию Laravel)
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('users', function (Blueprint $t) {
            $t->id();
            $t->string('email', 190)->unique();
            $t->timestamp('email_verified_at')->nullable();
            $t->string('phone', 32)->nullable();
            $t->string('password')->nullable();
            $t->string('name', 120)->nullable();
            $t->enum('role', ['customer','admin','seller','moderator'])->default('customer');
            $t->decimal('balance', 12, 2)->default(0);
            $t->boolean('is_blocked')->default(false);
            $t->timestamp('last_login_at')->nullable();
            $t->rememberToken();
            $t->timestamps();
            $t->index('role');
        });

        Schema::create('password_reset_tokens', function (Blueprint $t) {
            $t->string('email')->primary();
            $t->string('token');
            $t->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $t) {
            $t->string('id')->primary();
            $t->foreignId('user_id')->nullable()->index();
            $t->string('ip_address', 45)->nullable();
            $t->text('user_agent')->nullable();
            $t->longText('payload');
            $t->integer('last_activity')->index();
        });

        Schema::create('oauth_identities', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->enum('provider', ['vk','yandex','telegram']);
            $t->string('provider_uid', 191);
            $t->json('raw_profile')->nullable();
            $t->timestamps();
            $t->unique(['provider','provider_uid']);
        });

        Schema::create('sellers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('display_name', 120);
            $t->string('slug', 120)->unique();
            $t->enum('legal_type', ['platform','individual','self_employed','ie','llc'])->default('individual');
            $t->json('legal_info')->nullable();
            $t->decimal('commission_pct', 5, 2)->default(10);
            $t->decimal('rating', 3, 2)->default(0);
            $t->unsignedInteger('reviews_count')->default(0);
            $t->timestamp('verified_at')->nullable();
            $t->enum('status', ['draft','pending','active','blocked'])->default('active');
            $t->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('sellers');
        Schema::dropIfExists('oauth_identities');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
