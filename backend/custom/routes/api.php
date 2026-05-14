<?php

use App\Http\Controllers\Api\Admin\AuthController as AdminAuth;
use App\Http\Controllers\Api\Admin\CategoryController as AdminCategory;
use App\Http\Controllers\Api\Admin\OrderController as AdminOrder;
use App\Http\Controllers\Api\Admin\PaymentMethodController as AdminPaymentMethod;
use App\Http\Controllers\Api\Admin\PricingController as AdminPricing;
use App\Http\Controllers\Api\Admin\ProductController as AdminProduct;
use App\Http\Controllers\Api\Admin\ProviderCatalogController as AdminProviderCatalog;
use App\Http\Controllers\Api\Admin\ProviderController as AdminProvider;
use App\Http\Controllers\Api\Admin\QueueController as AdminQueue;
use App\Http\Controllers\Api\Admin\SettingController as AdminSetting;
use App\Http\Controllers\Api\Admin\StockController as AdminStock;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Me\OrderController as MeOrderController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\PaymentWebhookController;
use App\Http\Controllers\Api\ProductController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// ---------- Публичные ----------
Route::get('/health', fn () => ['status' => 'ok', 'time' => now()->toIso8601String()]);

Route::prefix('categories')->group(function () {
    Route::get('/', [CategoryController::class, 'index']);
});

Route::prefix('products')->group(function () {
    Route::get('/', [ProductController::class, 'index']);
    Route::get('/{product:slug}', [ProductController::class, 'show']);
});

// Лёгкая публичная валидация Steam-логина с rate-limit (30 запросов/мин на IP)
Route::get('/steam-validate', \App\Http\Controllers\Api\SteamValidateController::class)
    ->middleware('throttle:30,1');

// Публичный список способов оплаты (для /checkout)
Route::get('/payment-methods', [\App\Http\Controllers\Api\PaymentMethodController::class, 'index']);

Route::post('/checkout', CheckoutController::class);
// Webhook от Freekassa. Старый путь /fkwallet/ оставляем для обратной совместимости.
// Принимаем И POST, И GET — FK в кабинете может быть настроен любым способом.
// Если пришёл GET без данных — это health-check, контроллер сам разрулит.
Route::match(['get', 'post'], '/payments/fkwallet/webhook', PaymentWebhookController::class)
    ->withoutMiddleware(['auth:sanctum']);
Route::match(['get', 'post'], '/payments/freekassa/webhook', PaymentWebhookController::class)
    ->withoutMiddleware(['auth:sanctum']);
Route::get('/payments/fkwallet/check', [PaymentWebhookController::class, 'check']);

// ---------- Авторизация (общий для покупателей и админов) ----------
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/verify-email', [AuthController::class, 'verifyEmail']);
        Route::post('/resend-verification', [AuthController::class, 'resendVerification']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    // Старый алиас — фронт пока использует /api/me.
    Route::get('/me', [AuthController::class, 'me']);

    // Личный кабинет покупателя
    Route::prefix('me')->group(function () {
        Route::patch('/', [AuthController::class, 'updateProfile']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
        Route::post('/change-email', [AuthController::class, 'changeEmail']);
        Route::get('/orders', [MeOrderController::class, 'index']);
        Route::get('/orders/{public_number}', [MeOrderController::class, 'show']);
        Route::post('/orders/{public_number}/resend', [MeOrderController::class, 'resend']);
    });
});

// ---------- Админка ----------
Route::post('/admin/login', [AdminAuth::class, 'login']);

Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('/me', [AdminAuth::class, 'me']);
    Route::post('/logout', [AdminAuth::class, 'logout']);

    Route::get('/categories', [AdminCategory::class, 'index']);
    Route::post('/categories', [AdminCategory::class, 'store']);
    Route::get('/categories/{category:id}', [AdminCategory::class, 'show']);
    Route::put('/categories/{category:id}', [AdminCategory::class, 'update']);
    Route::delete('/categories/{category:id}', [AdminCategory::class, 'destroy']);
    Route::post('/categories/{category:id}/image', [AdminCategory::class, 'uploadImage']);

    // Админка работает по числовым id, а у моделей getRouteKeyName=slug/public_number —
    // поэтому явно фиксируем bind по id, иначе будет 404 (Laravel искал бы по slug).
    Route::get('/products', [AdminProduct::class, 'index']);
    Route::post('/products', [AdminProduct::class, 'store']);
    Route::get('/products/{product:id}', [AdminProduct::class, 'show']);
    Route::put('/products/{product:id}', [AdminProduct::class, 'update']);
    Route::delete('/products/{product:id}', [AdminProduct::class, 'destroy']);
    Route::post('/products/{product:id}/images', [AdminProduct::class, 'uploadImage']);
    Route::put('/products/{product:id}/images/{image:id}/primary', [AdminProduct::class, 'makeImagePrimary']);
    Route::delete('/products/{product:id}/images/{image:id}', [AdminProduct::class, 'deleteImage']);

    Route::get('/products/{product:id}/stock', [AdminStock::class, 'index']);
    Route::post('/products/{product:id}/stock', [AdminStock::class, 'store']);
    Route::delete('/products/{product:id}/stock/{stockItem}', [AdminStock::class, 'destroy']);

    Route::get('/orders', [AdminOrder::class, 'index']);
    Route::get('/orders/{order:id}', [AdminOrder::class, 'show']);
    Route::post('/orders/{order:id}/cancel', [AdminOrder::class, 'cancel']);
    Route::post('/orders/{order:id}/refund', [AdminOrder::class, 'refund']);
    Route::post('/orders/{order:id}/redeliver', [AdminOrder::class, 'redeliver']);
    Route::post('/orders/{order:id}/refulfill', [AdminOrder::class, 'refulfill']);
    Route::post('/orders/{order:id}/items/{item:id}/check-withdrawal', [AdminOrder::class, 'checkWithdrawal']);

    Route::get('/queue', [AdminQueue::class, 'index']);
    Route::post('/queue/{task}/claim', [AdminQueue::class, 'claim']);
    Route::post('/queue/{task}/complete', [AdminQueue::class, 'complete']);
    Route::post('/queue/{task}/cancel', [AdminQueue::class, 'cancel']);

    Route::get('/providers', [AdminProvider::class, 'index']);
    Route::post('/providers', [AdminProvider::class, 'store']);
    Route::get('/providers/{provider}', [AdminProvider::class, 'show']);
    Route::put('/providers/{provider}', [AdminProvider::class, 'update']);
    Route::get('/providers/{provider}/sync-runs', [AdminProvider::class, 'syncRuns']);
    Route::post('/providers/{provider}/sync', [AdminProviderCatalog::class, 'sync']);
    Route::get('/providers/{provider}/catalog', [AdminProviderCatalog::class, 'index']);
    Route::post('/providers/{provider}/catalog/connect-all', [AdminProviderCatalog::class, 'connectAll']);
    Route::get('/providers/{provider}/catalog/{externalId}', [AdminProviderCatalog::class, 'show']);
    Route::post('/providers/{provider}/catalog/{externalId}/connect', [AdminProviderCatalog::class, 'connect']);

    Route::get('/pricing', [AdminPricing::class, 'index']);
    Route::post('/pricing', [AdminPricing::class, 'store']);
    Route::post('/pricing/recompute', [AdminPricing::class, 'recompute']);
    Route::put('/pricing/{rule}', [AdminPricing::class, 'update']);
    Route::delete('/pricing/{rule}', [AdminPricing::class, 'destroy']);

    Route::get('/settings', [AdminSetting::class, 'index']);
    Route::put('/settings', [AdminSetting::class, 'update']);

    Route::get('/payment-methods', [AdminPaymentMethod::class, 'index']);
    Route::post('/payment-methods', [AdminPaymentMethod::class, 'store']);
    Route::post('/payment-methods/reorder', [AdminPaymentMethod::class, 'reorder']);
    Route::get('/payment-methods/{method:id}', [AdminPaymentMethod::class, 'show']);
    Route::put('/payment-methods/{method:id}', [AdminPaymentMethod::class, 'update']);
    Route::delete('/payment-methods/{method:id}', [AdminPaymentMethod::class, 'destroy']);
});
