<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Provider extends Model {
    protected $fillable = ['code','name','base_url','credentials','settings','is_enabled','status','last_sync_at','last_error_text'];
    protected $casts = [
        'credentials' => 'encrypted',
        'settings' => 'array',
        'is_enabled' => 'boolean',
        'last_sync_at' => 'datetime',
        'last_error_at' => 'datetime',
    ];

    public function providerProducts(): HasMany { return $this->hasMany(ProviderProduct::class); }
    public function logs(): HasMany { return $this->hasMany(ProviderLog::class); }
}
