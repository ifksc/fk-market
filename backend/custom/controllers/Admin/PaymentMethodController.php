<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentMethodController extends Controller
{
    public function index(): JsonResponse
    {
        $methods = PaymentMethod::orderBy('sort_order')->orderBy('id')->get();
        return response()->json(['data' => $methods->map(fn ($m) => $this->transform($m))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request, isCreate: true);
        $m = PaymentMethod::create($data);
        return response()->json(['data' => $this->transform($m)], 201);
    }

    public function show(PaymentMethod $method): JsonResponse
    {
        return response()->json(['data' => $this->transform($method)]);
    }

    public function update(Request $request, PaymentMethod $method): JsonResponse
    {
        $data = $this->validateData($request, isCreate: false, current: $method);
        $method->update($data);
        return response()->json(['data' => $this->transform($method->fresh())]);
    }

    public function destroy(PaymentMethod $method): JsonResponse
    {
        $method->delete();
        return response()->json(['data' => ['ok' => true]]);
    }

    /**
     * POST /admin/payment-methods/reorder
     * body: { order: [id, id, id, …] } — порядок становится sort_order: 10, 20, 30…
     */
    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order' => ['required', 'array'],
            'order.*' => ['integer'],
        ]);
        $sort = 10;
        foreach ($data['order'] as $id) {
            PaymentMethod::where('id', $id)->update(['sort_order' => $sort]);
            $sort += 10;
        }
        return response()->json(['data' => ['ok' => true]]);
    }

    private function validateData(Request $request, bool $isCreate, ?PaymentMethod $current = null): array
    {
        $codeRule = $isCreate
            ? ['required', 'string', 'max:40', Rule::unique('payment_methods', 'code')]
            : ['sometimes', 'string', 'max:40', Rule::unique('payment_methods', 'code')->ignore($current?->id)];

        return $request->validate([
            'code' => $codeRule,
            'name' => [$isCreate ? 'required' : 'sometimes', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'icon' => ['nullable', 'string', 'max:40'],
            'fk_id' => ['nullable', 'integer'],
            'integration_mode' => ['nullable', 'in:sci,api'],
            'is_enabled' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer'],
            'min_amount' => ['nullable', 'numeric', 'min:0'],
            'max_amount' => ['nullable', 'numeric', 'min:0'],
            'extra_fee_pct' => ['nullable', 'numeric', 'min:-50', 'max:200'],
            'config' => ['nullable', 'array'],
        ]);
    }

    private function transform(PaymentMethod $m): array
    {
        return [
            'id' => $m->id,
            'code' => $m->code,
            'name' => $m->name,
            'description' => $m->description,
            'icon' => $m->icon,
            'fk_id' => $m->fk_id,
            'integration_mode' => $m->integration_mode ?? 'sci',
            'is_enabled' => (bool) $m->is_enabled,
            'sort_order' => $m->sort_order,
            'min_amount' => $m->min_amount ? (float) $m->min_amount : null,
            'max_amount' => $m->max_amount ? (float) $m->max_amount : null,
            'extra_fee_pct' => (float) $m->extra_fee_pct,
            'config' => $m->config,
        ];
    }
}
