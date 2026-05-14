<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payout extends Model {
    protected $fillable = ['seller_id','amount','currency','provider','method','destination','provider_payout_id','status','raw_response','processed_at'];
    protected $casts = ['raw_response' => 'array','processed_at' => 'datetime','amount' => 'decimal:2'];
    public function seller(): BelongsTo { return $this->belongsTo(Seller::class); }
}
