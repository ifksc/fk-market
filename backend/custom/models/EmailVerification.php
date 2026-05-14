<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class EmailVerification extends Model
{
    protected $fillable = ['user_id', 'token', 'code', 'new_email', 'expires_at', 'used_at'];

    protected $casts = [
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at?->isPast() ?? false;
    }

    public function isUsed(): bool
    {
        return $this->used_at !== null;
    }

    public function isValid(): bool
    {
        return !$this->isUsed() && !$this->isExpired();
    }

    /**
     * Создать запись подтверждения с 6-значным кодом (TTL 30 мин).
     * Token (64 char) тоже генерируем — на случай магической ссылки в будущем.
     *
     * Все предыдущие неиспользованные verification'ы юзера помечаются `used_at=now`
     * (де-факто отменяются). Это:
     *  1) даёт юзеру указать другой email до подтверждения первого, не подсунув
     *     при этом старый/неверный pending_email;
     *  2) инвалидирует код из старого письма, если оно с задержкой дойдёт после
     *     того как юзер уже сменил email (security).
     */
    public static function issue(User $user, ?string $newEmail = null): self
    {
        self::where('user_id', $user->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        return self::create([
            'user_id' => $user->id,
            'token' => Str::random(64),
            'code' => (string) random_int(100000, 999999),
            'new_email' => $newEmail,
            'expires_at' => now()->addMinutes(30),
        ]);
    }
}
