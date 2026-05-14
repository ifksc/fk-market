<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProviderProduct extends Model {
    protected $fillable = ['provider_id','external_id','product_id','raw_meta','price_in','in_stock','last_seen_at'];
    protected $casts = ['raw_meta' => 'array','last_seen_at' => 'datetime','price_in' => 'decimal:2'];
    public function provider(): BelongsTo { return $this->belongsTo(Provider::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
