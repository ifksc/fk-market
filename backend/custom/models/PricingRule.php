<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class PricingRule extends Model {
    protected $fillable = ['scope','scope_id','markup_pct','priority','is_active'];
    protected $casts = ['is_active' => 'boolean','markup_pct' => 'decimal:2'];

    /** Найти подходящее правило для товара. */
    public static function resolveFor(Product $p): ?self
    {
        return static::query()
            ->where('is_active', true)
            ->where(function ($q) use ($p) {
                $q->where(fn($qq) => $qq->where('scope','product')->where('scope_id',$p->id))
                  ->orWhere(fn($qq) => $qq->where('scope','seller')->where('scope_id',$p->seller_id))
                  ->orWhere(fn($qq) => $qq->where('scope','category')->where('scope_id',$p->category_id))
                  ->orWhere('scope','global');
            })
            ->orderByRaw("FIELD(scope,'product','seller','category','global')")
            ->orderByDesc('priority')
            ->first();
    }
}
