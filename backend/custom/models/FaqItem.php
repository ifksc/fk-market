<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class FaqItem extends Model
{
    protected $fillable = ['question', 'answer', 'category', 'is_general', 'sort', 'is_active'];

    protected $casts = [
        'is_general' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'faq_item_product');
    }
}
