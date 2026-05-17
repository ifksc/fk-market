<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Публичный блог: список опубликованных статей и страница статьи.
 */
class BlogController extends Controller
{
    /**
     * GET /api/blog — список опубликованных статей.
     * Query: ?tag=steam&page=1
     */
    public function index(Request $request): JsonResponse
    {
        $q = BlogPost::query()->published()->orderByDesc('published_at');

        if ($tag = $request->string('tag')->toString()) {
            $q->whereJsonContains('tags', $tag);
        }

        // per_page переопределяется (sitemap тянет все статьи разом).
        $posts = $q->paginate($request->integer('per_page', 10));

        return response()->json([
            'data' => $posts->getCollection()->map(fn (BlogPost $p) => $this->card($p)),
            'meta' => [
                'total' => $posts->total(),
                'per_page' => $posts->perPage(),
                'current_page' => $posts->currentPage(),
                'last_page' => $posts->lastPage(),
            ],
        ]);
    }

    /** GET /api/blog/{slug} — страница статьи (только опубликованные). */
    public function show(string $slug): JsonResponse
    {
        $post = BlogPost::query()->published()->where('slug', $slug)->firstOrFail();

        return response()->json([
            'data' => array_merge($this->card($post), [
                'meta_description' => $post->meta_description,
                'content' => $post->content,
                'related_products' => $post->related_products ?? [],
                'related_posts' => $post->related_posts ?? [],
                'faq' => $post->faq ?? [],
                'updated_at' => $post->updated_at?->toIso8601String(),
            ]),
        ]);
    }

    /**
     * Поля для карточки статьи (список) — без тяжёлого content.
     *
     * @return array<string, mixed>
     */
    private function card(BlogPost $p): array
    {
        return [
            'id' => $p->id,
            'slug' => $p->slug,
            'title' => $p->title,
            'excerpt' => $p->excerpt,
            'cover_image' => $p->cover_image,
            'author' => $p->author,
            'tags' => $p->tags ?? [],
            'published_at' => $p->published_at?->toIso8601String(),
            'updated_at' => $p->updated_at?->toIso8601String(),
        ];
    }
}
