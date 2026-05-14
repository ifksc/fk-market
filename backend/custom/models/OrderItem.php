<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class OrderItem extends Model {
    protected $fillable = [
        'order_id','product_id','seller_id','qty','price','price_in','total',
        'params','stock_item_id','provider_order_id','fulfillment_status',
        'delivered_payload','delivered_at',
    ];
    protected $casts = [
        'params' => 'array',
        'delivered_payload' => 'encrypted',
        'delivered_at' => 'datetime',
        'price' => 'decimal:2','price_in' => 'decimal:2','total' => 'decimal:2',
    ];

    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function seller(): BelongsTo { return $this->belongsTo(Seller::class); }
    public function stockItem(): BelongsTo { return $this->belongsTo(StockItem::class); }
    public function fulfillmentTask(): HasOne { return $this->hasOne(FulfillmentTask::class); }
}
