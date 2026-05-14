<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model {
    protected $fillable = [
        'seller_id','category_id','slug','name','short_description','description',
        'price_base','markup_pct','price_final','price_old','currency',
        'fulfillment_mode','fulfillment_fallback','provider_id','provider_external_id',
        'required_params','status','published_at','stock_available','variants_count','auto_hidden_at',
    ];
    protected $casts = [
        'required_params' => 'array',
        'price_base' => 'decimal:2','price_final' => 'decimal:2','price_old' => 'decimal:2',
        'markup_pct' => 'decimal:2','rating' => 'decimal:2',
        'published_at' => 'datetime', 'auto_hidden_at' => 'datetime',
    ];

    public function seller(): BelongsTo { return $this->belongsTo(Seller::class); }
    public function category(): BelongsTo { return $this->belongsTo(Category::class); }
    public function provider(): BelongsTo { return $this->belongsTo(Provider::class); }
    public function images(): HasMany { return $this->hasMany(ProductImage::class)->orderBy('sort_order'); }
    public function stockItems(): HasMany { return $this->hasMany(StockItem::class); }
    public function reviews(): HasMany { return $this->hasMany(Review::class)->where('is_approved', true); }

    public function getRouteKeyName(): string { return 'slug'; }

    public function scopeActive(Builder $q): Builder { return $q->where('status', 'active'); }
    public function scopeSearch(Builder $q, string $term): Builder
    {
        return $q->whereFullText(['name','short_description','description'], $term);
    }

    public function primaryImage(): ?ProductImage { return $this->images->where('is_primary', true)->first() ?? $this->images->first(); }
    public function hasDiscount(): bool { return $this->price_old && $this->price_old > $this->price_final; }
    public function discountPct(): int
    {
        if (!$this->hasDiscount()) return 0;
        return (int) round((1 - $this->price_final / $this->price_old) * 100);
    }
}
