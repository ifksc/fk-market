<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model {
    protected $primaryKey = 'key';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $fillable = ['key','value','type','description','updated_at'];

    public static function get(string $key, mixed $default = null): mixed
    {
        $s = static::find($key);
        if (!$s) return $default;
        return match ($s->type) {
            'int' => (int) $s->value,
            'bool' => (bool) $s->value,
            'json' => json_decode($s->value, true),
            default => $s->value,
        };
    }
}
