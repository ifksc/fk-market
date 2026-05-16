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

    /**
     * Подпадает ли товар под ограничения промокода.
     * Если category_ids и product_ids пусты — промокод без ограничений (true для всех).
     */
    public function coversProduct(Product $product): bool
    {
        $hasProducts = !empty($this->product_ids);
        $hasCategories = !empty($this->category_ids);
        if (!$hasProducts && !$hasCategories) {
            return true;
        }
        if ($hasProducts && in_array($product->id, $this->product_ids)) {
            return true;
        }
        if ($hasCategories && in_array($product->category_id, $this->category_ids)) {
            return true;
        }
        return false;
    }

    /**
     * Скидка для подходящей суммы заказа ($eligibleSubtotal — сумма позиций,
     * подпадающих под промокод). percent — % с потолком max_discount; fixed — фикс.
     * Скидка не может превышать саму сумму.
     */
    public function discountFor(float $eligibleSubtotal): float
    {
        if ($eligibleSubtotal <= 0) {
            return 0.0;
        }
        $discount = $this->type === 'percent'
            ? $eligibleSubtotal * (float) $this->value / 100
            : (float) $this->value;

        if ($this->max_discount !== null) {
            $discount = min($discount, (float) $this->max_discount);
        }
        return round(min($discount, $eligibleSubtotal), 2);
    }
}
