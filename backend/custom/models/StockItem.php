<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockItem extends Model {
    public $timestamps = false;
    protected $fillable = ['product_id','payload','note','is_sold','sold_order_id','sold_at'];
    protected $casts = [
        'payload' => 'encrypted',  // auto-encrypt / decrypt via Laravel Crypt
        'is_sold' => 'boolean',
        'sold_at' => 'datetime',
    ];

    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
