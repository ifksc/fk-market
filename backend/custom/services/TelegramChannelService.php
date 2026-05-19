<?php

namespace App\Services;

use App\Models\BlogPost;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Публикация статей блога в Telegram-канал через Bot API.
 *
 * Конфиг читается из env напрямую (TELEGRAM_BOT_TOKEN, TELEGRAM_BLOG_CHANNEL,
 * TELEGRAM_HTTP_PROXY): кастом-слой не возит config/-файлы, а config на деплое
 * не кэшируется (artisan config:clear) — поэтому env() на рантайме работает.
 *
 * TELEGRAM_HTTP_PROXY — egress-прокси: прод-сервер (Yandex Cloud) ненадёжно
 * достукивается до Telegram напрямую, прокси с устойчивым доступом решает это.
 */
class TelegramChannelService
{
    private const SITE = 'https://fk.market';

    /** Настроен ли постинг (есть и токен бота, и канал). */
    public function isConfigured(): bool
    {
        return env('TELEGRAM_BOT_TOKEN') && env('TELEGRAM_BLOG_CHANNEL');
    }

    /**
     * Публикует статью в Telegram-канал: обложка + заголовок + excerpt + ссылка.
     *
     * @return array{ok: bool, message?: string, message_id?: int|null}
     */
    public function postBlogPost(BlogPost $post): array
    {
        $token = (string) env('TELEGRAM_BOT_TOKEN');
        $channel = (string) env('TELEGRAM_BLOG_CHANNEL');
        if ($token === '' || $channel === '') {
            return ['ok' => false, 'message' => 'Постинг в Telegram не настроен'];
        }

        $url = self::SITE . '/blog/' . $post->slug;
        $caption = $this->buildCaption($post, $url);

        // retry — только при сетевых сбоях (ConnectionException). throw:false —
        // HTTP-ошибки Telegram (403/400 и т.п.) НЕ мечем исключением, а
        // возвращаем ответ: иначе общий catch ниже подменял реальную причину
        // («Forbidden: bot is not a member…») на «Сеть недоступна».
        $request = Http::timeout(25)
            ->retry(2, 1000, fn ($e) => $e instanceof ConnectionException, throw: false);

        $proxy = (string) env('TELEGRAM_HTTP_PROXY');
        if ($proxy !== '') {
            $request = $request->withOptions(['proxy' => $proxy]);
        }

        try {
            // С обложкой — sendPhoto (фото + подпись), без — sendMessage.
            if ($post->cover_image) {
                $resp = $request->post("https://api.telegram.org/bot{$token}/sendPhoto", [
                    'chat_id' => $channel,
                    'photo' => $post->cover_image,
                    'caption' => $caption,
                    'parse_mode' => 'HTML',
                ]);
            } else {
                $resp = $request->post("https://api.telegram.org/bot{$token}/sendMessage", [
                    'chat_id' => $channel,
                    'text' => $caption,
                    'parse_mode' => 'HTML',
                ]);
            }
        } catch (\Throwable $e) {
            // Сообщение исключения от HTTP-вызова может содержать URL с токеном
            // бота или строку прокси с паролем — вырезаем их перед логом.
            $msg = str_replace($token, '***', $e->getMessage());
            if ($proxy !== '') {
                $msg = str_replace($proxy, '***', $msg);
            }
            Log::warning('Telegram post failed', ['post_id' => $post->id, 'error' => $msg]);
            return ['ok' => false, 'message' => 'Сеть до Telegram недоступна — попробуйте ещё раз'];
        }

        $json = $resp->json();
        if (!$resp->successful() || !($json['ok'] ?? false)) {
            $desc = $json['description'] ?? ('HTTP ' . $resp->status());
            return ['ok' => false, 'message' => 'Telegram: ' . $desc];
        }

        return ['ok' => true, 'message_id' => $json['result']['message_id'] ?? null];
    }

    /** Подпись поста в HTML parse_mode. Текст из статьи экранируется. */
    private function buildCaption(BlogPost $post, string $url): string
    {
        $caption = '<b>' . $this->esc((string) $post->title) . '</b>';

        $excerpt = trim((string) ($post->excerpt ?? ''));
        if ($excerpt !== '') {
            $caption .= "\n\n" . $this->esc($excerpt);
        }

        $caption .= "\n\n" . '<a href="' . $this->esc($url) . '">Читать на сайте →</a>';

        return $caption;
    }

    private function esc(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    }
}
