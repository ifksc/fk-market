<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProviderLog extends Model {
    public $timestamps = false;
    protected $fillable = ['provider_id','operation','request','response','status_code','success','latency_ms','error_text','related_order_id'];
    protected $casts = ['success' => 'boolean','created_at' => 'datetime'];
    public function provider(): BelongsTo { return $this->belongsTo(Provider::class); }
}
