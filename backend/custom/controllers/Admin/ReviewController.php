<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Админка — модерация отзывов.
 * Отзывы приходят с премодерацией (`is_approved=false`); админ одобряет/скрывает.
 * При смене статуса/удалении пересчитывается rating товара.
 */
class ReviewController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Review::query()
            ->with(['product:id,name,slug', 'user:id,name,email'])
            ->orderByDesc('id');

        // Фильтр: pending (на модерации) / approved / all
        match ($request->string('status')->toString()) {
            'pending' => $q->where('is_approved', false),
            'approved' => $q->where('is_approved', true),
            default => null,
        };

        $page = $q->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $page->getCollection()->map(fn (Review $r) => $this->transform($r)),
            'meta' => [
                'total' => $page->total(),
                'per_page' => $page->perPage(),
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'pending_total' => Review::where('is_approved', false)->count(),
            ],
        ]);
    }

    public function approve(Review $review): JsonResponse
    {
        $review->update(['is_approved' => true]);
        $review->product?->recomputeRating();
        return response()->json(['data' => $this->transform($review->fresh(['product:id,name,slug', 'user:id,name,email']))]);
    }

    public function unapprove(Review $review): JsonResponse
    {
        $review->update(['is_approved' => false]);
        $review->product?->recomputeRating();
        return response()->json(['data' => $this->transform($review->fresh(['product:id,name,slug', 'user:id,name,email']))]);
    }

    public function destroy(Review $review): JsonResponse
    {
        $product = $review->product;
        $review->delete();
        $product?->recomputeRating();
        return response()->json(['data' => ['ok' => true]]);
    }

    /** @return array<string, mixed> */
    private function transform(Review $r): array
    {
        return [
            'id' => $r->id,
            'rating' => (int) $r->rating,
            'text' => $r->text,
            'is_approved' => (bool) $r->is_approved,
            'product' => $r->product ? [
                'id' => $r->product->id,
                'name' => $r->product->name,
                'slug' => $r->product->slug,
            ] : null,
            'author' => $r->user?->name ?? 'Покупатель',
            'author_email' => $r->user?->email,
            'created_at' => $r->created_at?->toIso8601String(),
        ];
    }
}
