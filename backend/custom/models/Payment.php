<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model {
    protected $fillable = [
        'order_id','provider','method','provider_payment_id','amount','currency',
        'status','redirect_url','raw_request','raw_response','paid_at','failed_reason',
    ];
    protected $casts = ['raw_request' => 'array','raw_response' => 'array','paid_at' => 'datetime','amount' => 'decimal:2'];
    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
}
