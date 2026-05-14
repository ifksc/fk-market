<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Сброс пароля — FK.market</title>
    <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; color: #1f2937; line-height: 1.5; }
        .box { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 14px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        h1 { font-size: 22px; margin: 0 0 12px; }
        .muted { color: #6b7280; font-size: 14px; }
        .btn { display: inline-block; background: linear-gradient(90deg,#7c3aed,#a855f7); color: #fff !important; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; margin: 18px 0; }
        .link { word-break: break-all; color: #7c3aed; font-size: 12px; }
        .footer { color: #9ca3af; font-size: 12px; margin-top: 18px; }
        .warn { background: #fff7ed; border-left: 3px solid #f59e0b; padding: 10px 14px; margin: 16px 0; color: #78350f; font-size: 13px; }
    </style>
</head>
<body>
<div class="box">
    <h1>Сброс пароля</h1>
    <p>Привет, {{ $userName }}!</p>
    <p>Вы (или кто-то от вашего имени) запросили сброс пароля для аккаунта на FK.market.</p>

    <a class="btn" href="{{ $resetUrl }}">Задать новый пароль</a>

    <p class="muted">Если кнопка не открывается:<br><span class="link">{{ $resetUrl }}</span></p>

    <div class="warn">
        Ссылка действительна 60 минут.<br>
        Если вы не запрашивали сброс — никаких действий не нужно, ваш текущий пароль остаётся без изменений.
    </div>
</div>
</body>
</html>
