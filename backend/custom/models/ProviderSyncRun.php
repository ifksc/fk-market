<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProviderSyncRun extends Model
{
    // У нас есть свои started_at / finished_at, дефолтные created_at/updated_at не нужны.
    public $timestamps = false;

    protected $fillable = [
        'provider_id', 'trigger', 'status', 'started_at', 'finished_at',
        'categories_synced', 'products_added', 'products_updated', 'products_stale',
        'refresh_updated', 'refresh_hidden', 'refresh_restored', 'refresh_variants_removed',
        'error_text',
    ];
    protected $casts = [
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class);
    }

    public function durationSeconds(): ?int
    {
        if (!$this->finished_at || !$this->started_at) return null;
        return (int) $this->started_at->diffInSeconds($this->finished_at);
    }
}
