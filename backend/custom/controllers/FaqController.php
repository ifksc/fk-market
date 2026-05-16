<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FaqItem;
use Illuminate\Http\JsonResponse;

/**
 * GET /api/faq — общий FAQ для страницы /faq.
 *
 * Возвращает активные вопросы с is_general=true, сгруппированные по разделам
 * (category). Вопросы без категории — в раздел «Общие вопросы».
 */
class FaqController extends Controller
{
    public function index(): JsonResponse
    {
        $items = FaqItem::where('is_general', true)
            ->where('is_active', true)
            ->orderBy('sort')
            ->orderBy('id')
            ->get(['id', 'question', 'answer', 'category']);

        $groups = [];
        foreach ($items as $item) {
            $category = $item->category ?: 'Общие вопросы';
            $groups[$category][] = [
                'id' => $item->id,
                'question' => $item->question,
                'answer' => $item->answer,
            ];
        }

        $data = [];
        foreach ($groups as $category => $questions) {
            $data[] = ['category' => $category, 'items' => $questions];
        }

        return response()->json(['data' => $data]);
    }
}
