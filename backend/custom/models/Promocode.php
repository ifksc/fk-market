<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Promocode extends Model {
    protected $fillable = [
        'code','type','value','min_total','max_discount','limit_total','limit_per_user',
        'used_count','category_ids','product_ids','valid_from','valid_until','is_active',
    ];
    protected $casts = [
        'category_ids' => 'array','product_ids' => 'array',
        'valid_from' => 'datetime','valid_until' => 'datetime',
        'is_active' => 'boolean','value' => 'decimal:2',
    ];

    public function isValid(): bool
    {
        if (!$this->is_active) return false;
        if ($this->valid_from && $this->valid_from->isFuture()) return false;
        if ($this->valid_until && $this->valid_until->isPast()) return false;
        if ($this->limit_total && $this->used_count >= $this->limit_total) return false;
        return true;
    }
}
