<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\Seller;
use App\Services\PriceRecomputer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PricingController extends Controller
{
    public function index(): JsonResponse
    {
        $rules = PricingRule::query()
            ->orderByRaw("FIELD(scope,'product','seller','category','global')")
            ->orderByDesc('priority')
            ->get();

        return response()->json([
            'data' => $rules->map(fn (PricingRule $r) => [
                'id' => $r->id,
                'scope' => $r->scope,
                'scope_id' => $r->scope_id,
                'scope_name' => $this->resolveScopeName($r),
                'markup_pct' => (float) $r->markup_pct,
                'priority' => $r->priority,
                'is_active' => (bool) $r->is_active,
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'scope' => ['required', 'in:global,category,seller,product'],
            'scope_id' => ['nullable', 'integer'],
            'markup_pct' => ['required', 'numeric', 'min:-50', 'max:500'],
            'priority' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        if ($data['scope'] === 'global') $data['scope_id'] = null;

        $rule = PricingRule::create($data);
        return response()->json(['data' => ['id' => $rule->id]], 201);
    }

    public function update(Request $request, PricingRule $rule): JsonResponse
    {
        $data = $request->validate([
            'markup_pct' => ['sometimes', 'numeric', 'min:-50', 'max:500'],
            'priority' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $rule->update($data);
        return response()->json(['data' => ['ok' => true]]);
    }

    public function destroy(PricingRule $rule): JsonResponse
    {
        if ($rule->scope === 'global') {
            return response()->json(['message' => 'Глобальное правило нельзя удалить — только обновить'], 422);
        }
        $rule->delete();
        return response()->json(['data' => ['ok' => true]]);
    }

    /**
     * POST /api/admin/pricing/recompute
     * Тяжёлая операция — расширяем лимиты PHP перед выполнением.
     */
    public function recompute(Request $request, PriceRecomputer $recomputer): JsonResponse
    {
        @set_time_limit(0);
        @ini_set('memory_limit', '512M');

        $data = $request->validate([
            'from_id' => ['nullable', 'integer', 'min:0'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'provider_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
        ]);

        $stats = $recomputer->recomputeAll([
            'from_id' => $data['from_id'] ?? null,
            'limit' => $data['limit'] ?? 500,
            'provider_id' => $data['provider_id'] ?? null,
            'category_id' => $data['category_id'] ?? null,
        ]);
        return response()->json(['data' => $stats]);
    }

    private function resolveScopeName(PricingRule $r): ?string
    {
        return match ($r->scope) {
            'global' => 'Все товары',
            'category' => Category::find($r->scope_id)?->name,
            'seller' => Seller::find($r->scope_id)?->display_name,
            'product' => Product::find($r->scope_id)?->name,
            default => null,
        };
    }
}
