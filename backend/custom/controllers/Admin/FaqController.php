<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\FaqItem;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Админка — управление частыми вопросами (FAQ).
 *
 * CRUD пула вопросов + привязка вопросов к товару.
 */
class FaqController extends Controller
{
    public function index(): JsonResponse
    {
        $items = FaqItem::orderBy('sort')->orderBy('id')->get();
        return response()->json([
            'data' => $items->map(fn (FaqItem $f) => $this->transform($f)),
        ]);
    }

    public function show(FaqItem $faq): JsonResponse
    {
        return response()->json(['data' => $this->transform($faq)]);
    }

    public function store(Request $request): JsonResponse
    {
        $faq = FaqItem::create($this->validated($request));
        return response()->json(['data' => $this->transform($faq)], 201);
    }

    public function update(Request $request, FaqItem $faq): JsonResponse
    {
        $faq->update($this->validated($request));
        return response()->json(['data' => $this->transform($faq->refresh())]);
    }

    public function destroy(FaqItem $faq): JsonResponse
    {
        $faq->delete();
        return response()->json(['data' => ['ok' => true]]);
    }

    /** GET /api/admin/products/{id}/faq — вопросы, привязанные к товару. */
    public function forProduct(Product $product): JsonResponse
    {
        $items = $product->faqItems()->orderBy('sort')->orderBy('id')->get();
        return response()->json([
            'data' => $items->map(fn (FaqItem $f) => $this->transform($f)),
        ]);
    }

    /** PUT /api/admin/products/{id}/faq — синхронизировать привязку (faq_item_ids). */
    public function syncForProduct(Request $request, Product $product): JsonResponse
    {
        $data = $request->validate([
            'faq_item_ids' => ['present', 'array'],
            'faq_item_ids.*' => ['integer', 'exists:faq_items,id'],
        ]);
        $product->faqItems()->sync($data['faq_item_ids']);

        $items = $product->faqItems()->orderBy('sort')->orderBy('id')->get();
        return response()->json([
            'data' => $items->map(fn (FaqItem $f) => $this->transform($f)),
        ]);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        $sometimes = $request->isMethod('post') ? ['required'] : ['sometimes'];

        return $request->validate([
            'question' => [...$sometimes, 'string', 'max:300'],
            'answer' => [...$sometimes, 'string', 'max:5000'],
            'category' => ['nullable', 'string', 'max:80'],
            'is_general' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }

    /** @return array<string, mixed> */
    private function transform(FaqItem $f): array
    {
        return [
            'id' => $f->id,
            'question' => $f->question,
            'answer' => $f->answer,
            'category' => $f->category,
            'is_general' => (bool) $f->is_general,
            'sort' => $f->sort,
            'is_active' => (bool) $f->is_active,
        ];
    }
}
