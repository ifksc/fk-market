<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Код подтверждения — FK.market</title>
    <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; color: #1f2937; line-height: 1.5; }
        .box { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 14px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        h1 { font-size: 22px; margin: 0 0 12px; }
        .muted { color: #6b7280; font-size: 14px; }
        .code-block { background: #f3e8ff; color: #5b21b6; font-size: 32px; letter-spacing: 8px; font-weight: 600; padding: 18px 24px; border-radius: 12px; text-align: center; margin: 24px 0; font-family: -apple-system, "SF Mono", "Menlo", monospace; }
        .footer { color: #9ca3af; font-size: 12px; margin-top: 18px; }
    </style>
</head>
<body>
<div class="box">
    <h1>Код подтверждения</h1>
    <p>Привет, {{ $userName }}!</p>
    <p>Введите этот код в форме на сайте, чтобы подтвердить почту:</p>

    <div class="code-block">{{ $code }}</div>

    <p class="muted">Код действителен <b>30 минут</b>. Если запрашиваете повторно — берите самый свежий, предыдущие перестают действовать.</p>

    <p class="footer">Если вы не регистрировались на FK.market — просто проигнорируйте это письмо.</p>
</div>
</body>
</html>
