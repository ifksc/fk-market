<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Promocode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Админка — CRUD промокодов.
 * Привязка к категориям/товарам (category_ids/product_ids) поддержана в БД и
 * валидации, но без UI в v1 — промокоды по умолчанию действуют на весь заказ.
 */
class PromocodeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Promocode::query()->orderByDesc('id');

        if ($search = $request->string('q')->toString()) {
            $q->whereRaw('LOWER(code) LIKE ?', ['%' . mb_strtolower($search) . '%']);
        }

        $page = $q->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $page->getCollection()->map(fn (Promocode $p) => $this->transform($p)),
            'meta' => [
                'total' => $page->total(),
                'per_page' => $page->perPage(),
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    public function show(Promocode $promocode): JsonResponse
    {
        return response()->json(['data' => $this->transform($promocode)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateInput($request, null);
        $data['code'] = mb_strtoupper($data['code']);
        $promocode = Promocode::create($data);
        return response()->json(['data' => $this->transform($promocode)], 201);
    }

    public function update(Request $request, Promocode $promocode): JsonResponse
    {
        $data = $this->validateInput($request, $promocode);
        if (isset($data['code'])) {
            $data['code'] = mb_strtoupper($data['code']);
        }
        $promocode->update($data);
        return response()->json(['data' => $this->transform($promocode->refresh())]);
    }

    public function destroy(Promocode $promocode): JsonResponse
    {
        $promocode->delete();
        return response()->json(['data' => ['ok' => true]]);
    }

    /** @return array<string, mixed> */
    private function validateInput(Request $request, ?Promocode $existing): array
    {
        $sometimes = $existing ? ['sometimes'] : ['required'];

        return $request->validate([
            'code' => [...$sometimes, 'string', 'max:60', Rule::unique('promocodes', 'code')->ignore($existing?->id)],
            'type' => [...$sometimes, 'in:percent,fixed'],
            'value' => [...$sometimes, 'numeric', 'min:0'],
            'min_total' => ['nullable', 'numeric', 'min:0'],
            'max_discount' => ['nullable', 'numeric', 'min:0'],
            'limit_total' => ['nullable', 'integer', 'min:1'],
            'limit_per_user' => ['nullable', 'integer', 'min:1'],
            'category_ids' => ['nullable', 'array'],
            'product_ids' => ['nullable', 'array'],
            'valid_from' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }

    /** @return array<string, mixed> */
    private function transform(Promocode $p): array
    {
        return [
            'id' => $p->id,
            'code' => $p->code,
            'type' => $p->type,
            'value' => (float) $p->value,
            'min_total' => $p->min_total !== null ? (float) $p->min_total : null,
            'max_discount' => $p->max_discount !== null ? (float) $p->max_discount : null,
            'limit_total' => $p->limit_total,
            'limit_per_user' => $p->limit_per_user,
            'used_count' => $p->used_count,
            'category_ids' => $p->category_ids,
            'product_ids' => $p->product_ids,
            'valid_from' => $p->valid_from?->toIso8601String(),
            'valid_until' => $p->valid_until?->toIso8601String(),
            'is_active' => (bool) $p->is_active,
            'is_valid' => $p->isValid(),
            'created_at' => $p->created_at?->toIso8601String(),
        ];
    }
}
