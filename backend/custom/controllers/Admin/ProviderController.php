<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Provider;
use App\Models\ProviderSyncRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProviderController extends Controller
{
    public function index(): JsonResponse
    {
        $providers = Provider::orderBy('name')
            ->withCount('providerProducts as products_count')
            ->get();

        return response()->json([
            'data' => $providers->map(fn (Provider $p) => [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'base_url' => $p->base_url,
                'is_enabled' => (bool) $p->is_enabled,
                'status' => $p->status,
                'last_sync_at' => $p->last_sync_at?->toIso8601String(),
                'last_error_at' => $p->last_error_at?->toIso8601String(),
                'last_error_text' => $p->last_error_text,
                'products_count' => $p->products_count,
                'has_credentials' => !empty($p->credentials),
                'settings' => $p->settings,
            ]),
        ]);
    }

    public function show(Provider $provider): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => $provider->id,
                'code' => $provider->code,
                'name' => $provider->name,
                'base_url' => $provider->base_url,
                'settings' => $provider->settings,
                'is_enabled' => (bool) $provider->is_enabled,
                'status' => $provider->status,
                'last_sync_at' => $provider->last_sync_at?->toIso8601String(),
                'last_error_at' => $provider->last_error_at?->toIso8601String(),
                'last_error_text' => $provider->last_error_text,
                'has_credentials' => !empty($provider->credentials),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:60', 'unique:providers,code'],
            'name' => ['required', 'string', 'max:120'],
            'base_url' => ['nullable', 'url', 'max:255'],
            'credentials' => ['nullable', 'string', 'max:5000'],
            'settings' => ['nullable', 'array'],
            'is_enabled' => ['nullable', 'boolean'],
        ]);
        $provider = Provider::create($data + ['status' => 'ok']);
        return response()->json(['data' => ['id' => $provider->id]], 201);
    }

    public function update(Request $request, Provider $provider): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'base_url' => ['nullable', 'url', 'max:255'],
            'credentials' => ['nullable', 'string', 'max:5000'],
            'settings' => ['nullable', 'array'],
            'is_enabled' => ['nullable', 'boolean'],
        ]);

        // Если в credentials пришла пустая строка — НЕ затираем (не отправили = не меняем)
        if (array_key_exists('credentials', $data) && ($data['credentials'] === '' || $data['credentials'] === null)) {
            unset($data['credentials']);
        }

        $provider->update($data);
        return response()->json(['data' => ['ok' => true]]);
    }

    /**
     * GET /api/admin/providers/{provider}/sync-runs?limit=10
     * История запусков синка для отображения в админке.
     */
    public function syncRuns(Provider $provider, Request $request): JsonResponse
    {
        $limit = (int) $request->integer('limit', 10);
        $limit = max(1, min(50, $limit));

        $runs = ProviderSyncRun::where('provider_id', $provider->id)
            ->orderByDesc('started_at')
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => $runs->map(fn (ProviderSyncRun $r) => [
                'id' => $r->id,
                'trigger' => $r->trigger,
                'status' => $r->status,
                'started_at' => $r->started_at?->toIso8601String(),
                'finished_at' => $r->finished_at?->toIso8601String(),
                'duration_sec' => $r->durationSeconds(),
                'categories_synced' => $r->categories_synced,
                'products_added' => $r->products_added,
                'products_updated' => $r->products_updated,
                'products_stale' => $r->products_stale,
                'refresh_updated' => $r->refresh_updated,
                'refresh_hidden' => $r->refresh_hidden,
                'refresh_restored' => $r->refresh_restored,
                'refresh_variants_removed' => $r->refresh_variants_removed,
                'error_text' => $r->error_text,
            ]),
        ]);
    }
}
