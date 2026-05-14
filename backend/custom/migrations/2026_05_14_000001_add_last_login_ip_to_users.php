<?php
// FK.market — добавляем last_login_ip в users, для аудита входов.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('users', function (Blueprint $t) {
            if (!Schema::hasColumn('users', 'last_login_ip')) {
                $t->string('last_login_ip', 45)->nullable()->after('last_login_at');
            }
        });
    }

    public function down(): void {
        Schema::table('users', function (Blueprint $t) {
            if (Schema::hasColumn('users', 'last_login_ip')) {
                $t->dropColumn('last_login_ip');
            }
        });
    }
};
