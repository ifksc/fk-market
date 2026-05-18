<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Services\TelegramChannelService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Админка — управление статьями блога.
 *
 * Доступ: EnsureBlogManagerMiddleware (admin + journalist). Видны и черновики.
 */
class BlogController extends Controller
{
    public function index(): JsonResponse
    {
        $posts = BlogPost::orderByDesc('created_at')->get();
        return response()->json([
            'data' => $posts->map(fn (BlogPost $p) => $this->transform($p)),
        ]);
    }

    public function show(BlogPost $post): JsonResponse
    {
        return response()->json(['data' => $this->transform($post)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        // Slug: берём заданный или генерируем из заголовка; гарантируем уникальность.
        $data['slug'] = $this->uniqueSlug($data['slug'] ?? null, $data['title'], null);
        // Автор по умолчанию — имя создателя статьи.
        $data['author'] = $data['author'] ?? $request->user()->name;
        $data = $this->applyPublishState($data, null);

        $post = BlogPost::create($data);
        return response()->json(['data' => $this->transform($post)], 201);
    }

    public function update(Request $request, BlogPost $post): JsonResponse
    {
        $data = $this->validated($request);

        if (array_key_exists('slug', $data) || array_key_exists('title', $data)) {
            $data['slug'] = $this->uniqueSlug(
                $data['slug'] ?? $post->slug,
                $data['title'] ?? $post->title,
                $post->id,
            );
        }
        $data = $this->applyPublishState($data, $post);

        $post->update($data);
        return response()->json(['data' => $this->transform($post->refresh())]);
    }

    public function destroy(BlogPost $post): JsonResponse
    {
        $post->delete();
        return response()->json(['data' => ['ok' => true]]);
    }

    /**
     * POST /api/admin/blog/{id}/cover — загрузка обложки статьи (1200×630).
     * Паттерн повторяет CategoryController::uploadImage.
     */
    public function uploadCover(Request $request, BlogPost $post): JsonResponse
    {
        $request->validate([
            // Только растровые форматы (до 5 МБ) — SVG исключён (может содержать скрипт).
            'image' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $file = $request->file('image');
        $hash = sha1_file($file->getRealPath()) ?: bin2hex(random_bytes(8));
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'bin');
        $path = "blog/{$post->id}/{$hash}.{$ext}";

        $storage = Storage::disk('public');

        // Удалим предыдущую обложку, если она в нашем storage.
        if ($post->cover_image && str_contains($post->cover_image, '/storage/')) {
            $oldRel = ltrim(parse_url($post->cover_image, PHP_URL_PATH) ?: '', '/');
            $oldRel = preg_replace('~^storage/~', '', $oldRel);
            if ($oldRel && $oldRel !== $path && $storage->exists($oldRel)) {
                $storage->delete($oldRel);
            }
        }

        $storage->put($path, file_get_contents($file->getRealPath()));
        $post->update(['cover_image' => $storage->url($path)]);

        return response()->json(['data' => $this->transform($post->refresh())]);
    }

    /**
     * POST /api/admin/blog/{id}/telegram — публикация статьи в Telegram-канал.
     */
    public function publishToTelegram(BlogPost $post, TelegramChannelService $telegram): JsonResponse
    {
        if ($post->status !== 'published') {
            return response()->json(['message' => 'Сначала опубликуйте статью на сайте'], 422);
        }

        $result = $telegram->postBlogPost($post);
        if (!($result['ok'] ?? false)) {
            return response()->json(['message' => $result['message'] ?? 'Не удалось опубликовать'], 502);
        }

        $post->update([
            'telegram_posted_at' => now(),
            'telegram_message_id' => $result['message_id'] ?? null,
        ]);

        return response()->json(['data' => $this->transform($post->refresh())]);
    }

    /**
     * Генерирует уникальный slug. Если задан явно — слугифицируем его, иначе
     * берём из заголовка. При коллизии добавляем суффикс -2, -3, …
     */
    private function uniqueSlug(?string $slug, string $title, ?int $ignoreId): string
    {
        $base = Str::slug($slug ?: $title) ?: 'post';
        $candidate = $base;
        $i = 2;
        while (
            BlogPost::where('slug', $candidate)
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->exists()
        ) {
            $candidate = "{$base}-{$i}";
            $i++;
        }
        return $candidate;
    }

    /**
     * Проставляет published_at при переходе в статус published (если ещё не
     * задана). Снятие с публикации дату не трогает — повторная публикация
     * сохранит исходную, если админ не задал её вручную.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function applyPublishState(array $data, ?BlogPost $post): array
    {
        $status = $data['status'] ?? $post?->status ?? 'draft';
        $hasDate = !empty($data['published_at']) || $post?->published_at;
        if ($status === 'published' && !$hasDate) {
            $data['published_at'] = now();
        }
        return $data;
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        $sometimes = $request->isMethod('post') ? ['required'] : ['sometimes'];

        return $request->validate([
            'title' => [...$sometimes, 'string', 'max:200'],
            'slug' => ['nullable', 'string', 'max:200'],
            'meta_description' => ['nullable', 'string', 'max:255'],
            'excerpt' => ['nullable', 'string', 'max:300'],
            'content' => ['nullable', 'string', 'max:100000'],
            'cover_image' => ['nullable', 'string', 'max:500'],
            'author' => ['nullable', 'string', 'max:120'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string', 'max:50'],
            'related_products' => ['nullable', 'array'],
            'related_products.*' => ['string', 'max:200'],
            'related_posts' => ['nullable', 'array'],
            'related_posts.*' => ['string', 'max:200'],
            'faq' => ['nullable', 'array'],
            'faq.*.question' => ['required', 'string', 'max:300'],
            'faq.*.answer' => ['required', 'string', 'max:5000'],
            'status' => ['nullable', 'in:draft,published'],
            'published_at' => ['nullable', 'date'],
        ]);
    }

    /** @return array<string, mixed> */
    private function transform(BlogPost $p): array
    {
        return [
            'id' => $p->id,
            'slug' => $p->slug,
            'title' => $p->title,
            'meta_description' => $p->meta_description,
            'excerpt' => $p->excerpt,
            'content' => $p->content,
            'cover_image' => $p->cover_image,
            'author' => $p->author,
            'tags' => $p->tags ?? [],
            'related_products' => $p->related_products ?? [],
            'related_posts' => $p->related_posts ?? [],
            'faq' => $p->faq ?? [],
            'status' => $p->status,
            'published_at' => $p->published_at?->toIso8601String(),
            'telegram_posted_at' => $p->telegram_posted_at?->toIso8601String(),
            'created_at' => $p->created_at?->toIso8601String(),
            'updated_at' => $p->updated_at?->toIso8601String(),
        ];
    }
}
