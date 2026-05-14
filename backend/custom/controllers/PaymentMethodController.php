<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use Illuminate\Http\JsonResponse;

/**
 * Публичный список включённых методов оплаты для /checkout.
 */
class PaymentMethodController extends Controller
{
    public function index(): JsonResponse
    {
        $methods = PaymentMethod::where('is_enabled', true)
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'data' => $methods->map(fn (PaymentMethod $m) => [
                'code' => $m->code,
                'name' => $m->name,
                'description' => $m->description,
                'icon' => $m->icon,
                'min_amount' => $m->min_amount ? (float) $m->min_amount : null,
                'max_amount' => $m->max_amount ? (float) $m->max_amount : null,
                'extra_fee_pct' => (float) $m->extra_fee_pct,
            ]),
        ]);
    }
}
