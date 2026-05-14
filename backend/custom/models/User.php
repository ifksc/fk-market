<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = ['email','phone','password','name','role','balance','is_blocked','last_login_at','last_login_ip','email_verified_at'];
    protected $hidden = ['password','remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'balance' => 'decimal:2',
            'is_blocked' => 'boolean',
        ];
    }

    public function oauthIdentities(): HasMany { return $this->hasMany(OauthIdentity::class); }
    public function emailVerifications(): HasMany { return $this->hasMany(EmailVerification::class); }
    public function supportTickets(): HasMany { return $this->hasMany(SupportTicket::class); }
    public function seller(): HasOne { return $this->hasOne(Seller::class); }
    public function orders(): HasMany { return $this->hasMany(Order::class); }
    public function reviews(): HasMany { return $this->hasMany(Review::class); }

    public function isAdmin(): bool { return $this->role === 'admin'; }
    public function isSeller(): bool { return $this->role === 'seller'; }
    public function isEmailVerified(): bool { return $this->email_verified_at !== null; }
}
