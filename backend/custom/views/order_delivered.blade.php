<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>FK.market — заказ оплачен</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f9fafb; padding: 24px; }
.box { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 32px; }
h1 { font-size: 24px; margin: 0 0 8px; }
.muted { color: #6b7280; font-size: 14px; }
.code { background: #0f172a; color: #fff; padding: 12px 16px; border-radius: 8px; font-family: ui-monospace, monospace; font-size: 13px; word-break: break-all; }
.item { padding: 16px 0; border-top: 1px solid #e5e7eb; }
.item:first-child { border-top: 0; }
.btn { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 24px; }
</style>
</head>
<body>
<div class="box">
    <h1>Спасибо за заказ!</h1>
    <p class="muted">Заказ <b>{{ $order->public_number }}</b> от {{ $order->created_at->format('d.m.Y H:i') }}</p>

    <h2 style="font-size: 18px; margin-top: 24px;">Ваши коды и данные:</h2>

    @foreach($order->items as $item)
        <div class="item">
            <div style="font-weight: 600;">{{ $item->product->name ?? 'Товар' }}</div>
            <div class="muted" style="margin-bottom: 8px;">{{ $item->qty }} шт · {{ number_format($item->price, 0, '.', ' ') }} ₽</div>

            @if($item->fulfillment_status === 'delivered' && $item->delivered_payload)
                <div class="code">{{ $item->delivered_payload }}</div>
            @elseif($item->fulfillment_status === 'queued')
                <div class="muted">⏳ Обрабатывается администратором — придёт отдельным письмом в течение 4 часов</div>
            @else
                <div class="muted">Статус: {{ $item->fulfillment_status }}</div>
            @endif
        </div>
    @endforeach

    <p class="muted" style="margin-top: 24px;">
        Все заказы и коды доступны в личном кабинете на сайте FK.market.
        Если код не работает — напишите в поддержку, заменим в течение 14 дней.
    </p>

    <a class="btn" href="https://fk.market/account">Открыть личный кабинет</a>
</div>
</body>
</html>
