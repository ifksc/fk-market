<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model {
    const UPDATED_AT = null;
    protected $fillable = ['user_id','action','subject_type','subject_id','payload','ip','user_agent'];
    protected $casts = ['payload' => 'array','created_at' => 'datetime'];
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
