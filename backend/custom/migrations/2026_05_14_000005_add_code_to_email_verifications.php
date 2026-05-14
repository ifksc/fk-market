<?php
// FK.market — переходим с magic-link на 6-значный цифровой код.
// Колонка token остаётся (вдруг понадобится magic-link).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('email_verifications', function (Blueprint $t) {
            if (!Schema::hasColumn('email_verifications', 'code')) {
                $t->string('code', 8)->nullable()->after('token');
                $t->index(['user_id', 'code']);
            }
        });
    }

    public function down(): void {
        Schema::table('email_verifications', function (Blueprint $t) {
            if (Schema::hasColumn('email_verifications', 'code')) {
                $t->dropIndex(['user_id', 'code']);
                $t->dropColumn('code');
            }
        });
    }
};
