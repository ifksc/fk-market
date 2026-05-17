<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Category extends Model {
    protected $fillable = [
        'parent_id','provider_id','provider_external_id',
        'slug','legacy_slug','name','description','icon','image_url','sort_order',
        'is_active','show_in_header','is_new',
    ];
    protected $casts = [
        'is_active' => 'boolean',
        'show_in_header' => 'boolean',
        'is_new' => 'boolean',
    ];

    public function parent(): BelongsTo { return $this->belongsTo(self::class, 'parent_id'); }
    public function children(): HasMany { return $this->hasMany(self::class, 'parent_id'); }
    public function products(): HasMany { return $this->hasMany(Product::class); }
    public function provider(): BelongsTo { return $this->belongsTo(Provider::class); }

    public function getRouteKeyName(): string { return 'slug'; }

    /**
     * ID самой категории + всех её потомков (по parent_id).
     * Использует рекурсивный CTE — нужен MySQL 8+. Глубина ограничена 16 уровнями
     * на случай битых данных (циклы parent_id), хотя такого быть не должно.
     */
    public static function subtreeIds(int $rootId): array
    {
        $rows = DB::select(<<<SQL
            WITH RECURSIVE subtree (id, depth) AS (
                SELECT id, 0 FROM categories WHERE id = ?
                UNION ALL
                SELECT c.id, s.depth + 1
                FROM categories c
                INNER JOIN subtree s ON c.parent_id = s.id
                WHERE s.depth < 16
            )
            SELECT id FROM subtree
        SQL, [$rootId]);

        return array_map(fn ($r) => (int) $r->id, $rows);
    }
}
