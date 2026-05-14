<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FulfillmentTask extends Model {
    protected $fillable = [
        'order_item_id','mode','provider_id','status','assignee_id',
        'input_params','result','retries','error_text','deadline_at','started_at','finished_at',
    ];
    protected $casts = [
        'input_params' => 'array','result' => 'array',
        'deadline_at' => 'datetime','started_at' => 'datetime','finished_at' => 'datetime',
    ];

    public function orderItem(): BelongsTo { return $this->belongsTo(OrderItem::class); }
    public function provider(): BelongsTo { return $this->belongsTo(Provider::class); }
    public function assignee(): BelongsTo { return $this->belongsTo(User::class, 'assignee_id'); }

    public function isOverdue(): bool { return $this->deadline_at && $this->deadline_at->isPast() && !in_array($this->status, ['done','cancelled']); }
}
