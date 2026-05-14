<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model {
    protected $fillable = [
        'public_number','user_id','email','phone','currency',
        'subtotal','discount','total','promocode_id','status',
        'payment_id','utm','ip','user_agent','paid_at','completed_at',
    ];
    protected $casts = [
        'utm' => 'array',
        'subtotal' => 'decimal:2','discount' => 'decimal:2','total' => 'decimal:2',
        'paid_at' => 'datetime','completed_at' => 'datetime',
    ];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function promocode(): BelongsTo { return $this->belongsTo(Promocode::class); }
    public function items(): HasMany { return $this->hasMany(OrderItem::class); }
    public function payments(): HasMany { return $this->hasMany(Payment::class); }

    public function getRouteKeyName(): string { return 'public_number'; }
}
