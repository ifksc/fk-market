<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentMethod extends Model
{
    protected $fillable = [
        'code', 'name', 'description', 'icon', 'fk_id', 'integration_mode',
        'is_enabled', 'sort_order',
        'min_amount', 'max_amount', 'extra_fee_pct', 'config',
    ];
    protected $casts = [
        'is_enabled' => 'boolean',
        'fk_id' => 'integer',
        'sort_order' => 'integer',
        'min_amount' => 'decimal:2',
        'max_amount' => 'decimal:2',
        'extra_fee_pct' => 'decimal:2',
        'config' => 'array',
    ];
}
