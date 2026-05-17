<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class BlogPost extends Model
{
    protected $fillable = [
        'slug', 'title', 'meta_description', 'excerpt', 'content', 'cover_image',
        'author', 'tags', 'related_products', 'related_posts', 'faq', 'status',
        'published_at', 'telegram_posted_at', 'telegram_message_id',
    ];

    protected $casts = [
        'tags' => 'array',
        'related_products' => 'array',
        'related_posts' => 'array',
        'faq' => 'array',
        'published_at' => 'datetime',
        'telegram_posted_at' => 'datetime',
    ];

    /** Публичные роуты /blog/{slug} биндятся по slug. */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /** Только опубликованные статьи с наступившей датой публикации. */
    public function scopePublished(Builder $q): Builder
    {
        return $q->where('status', 'published')
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }
}
