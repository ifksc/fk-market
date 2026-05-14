<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Seller extends Model {
    protected $fillable = ['user_id','display_name','slug','legal_type','legal_info','commission_pct','rating','status','verified_at'];
    protected $casts = ['legal_info' => 'array','commission_pct' => 'decimal:2','rating' => 'decimal:2','verified_at' => 'datetime'];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function products(): HasMany { return $this->hasMany(Product::class); }
    public function payouts(): HasMany { return $this->hasMany(Payout::class); }
}
