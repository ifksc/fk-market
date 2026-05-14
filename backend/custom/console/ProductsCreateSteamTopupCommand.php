<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Product;
use App\Models\Provider;
use App\Models\Seller;
use App\Services\PriceCalculator;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * php artisan products:create-steam-topup
 *   --min=100         минимальная сумма пополнения, ₽
 *   --max=15000       максимальная сумма пополнения, ₽
 *   --markup=5        наша наценка %
 *
 * Создаёт ровно один Product «Пополнение Steam» с динамической ценой:
 *   • поле steam_login   — валидируется через FK API
 *   • поле amount        — клиент выбирает сумму в указанных границах
 *
 * При оплате CheckoutController считает price = amount * (1 + markup/100).
 * FulfillViaApiJob дёргает FK /withdrawal с payment_system_id=10 (Steam).
 */
class ProductsCreateSteamTopupCommand extends Command
{
    protected $signature = 'products:create-steam-topup {--min=100} {--max=15000} {--markup=5}';
    protected $description = 'Создать товар «Пополнение Steam» с динамической суммой';

    public function handle(): int
    {
        $min = (int) $this->option('min');
        $max = (int) $this->option('max');
        $markup = (float) $this->option('markup');

        if ($min < 1 || $max <= $min) {
            $this->error("--min должен быть >0 и <--max");
            return 1;
        }

        $provider = Provider::where('code', 'fkwallet')->first();
        if (!$provider) {
            $this->error('Поставщик fkwallet не найден');
            return 1;
        }

        $platform = Seller::where('slug', 'platform')->firstOrFail();

        // Наша категория «Пополнение Steam» — создаём, если её ещё нет
        $category = Category::firstOrCreate(
            ['slug' => 'steam-topup'],
            [
                'name' => 'Пополнить Steam',
                'icon' => 'wallet',
                'sort_order' => 5,
                'is_active' => true,
                'show_in_header' => true,
                'is_new' => true,
            ],
        );

        // Проверим, нет ли уже такого товара (по slug)
        $existing = Product::where('slug', 'steam-topup')->first();
        if ($existing) {
            $this->warn("Товар уже существует: id={$existing->id}, slug={$existing->slug}");
            $this->info('Обновляю required_params и параметры…');
            $product = $existing;
        } else {
            $product = new Product();
            $product->slug = 'steam-topup';
        }

        $product->seller_id = $platform->id;
        $product->category_id = $category->id;
        $product->name = 'Пополнение Steam';
        $product->short_description = 'Пополнение баланса Steam на любую сумму. Зачисление 1–10 минут после оплаты.';
        $product->description = "Пополняем баланс вашего Steam-аккаунта на любую сумму от {$min} до {$max} ₽.\n\nКак это работает:\n1. Введите ваш логин Steam (мы проверим его существование).\n2. Укажите сумму пополнения.\n3. После оплаты деньги поступят на ваш аккаунт в течение 1–10 минут.\n\nКомиссия — {$markup}% от суммы.";
        $product->price_base = $min;
        $product->markup_pct = $markup;
        $product->price_final = round($min * (1 + $markup / 100), 2);
        $product->currency = 'RUB';
        $product->fulfillment_mode = 'api';
        $product->fulfillment_fallback = 'manual';
        $product->provider_id = $provider->id;
        $product->provider_external_id = null;
        $product->required_params = [
            [
                'name' => 'steam_login',
                'label' => 'Логин Steam',
                'type' => 'steam_login',
                'required' => true,
                'hint' => 'Логин аккаунта Steam, на который придёт пополнение',
            ],
            [
                'name' => 'amount',
                'label' => 'Сумма пополнения, ₽',
                'type' => 'amount_input',
                'required' => true,
                'min' => $min,
                'max' => $max,
                'fee_pct' => $markup,
                'payment_system_id' => 10, // Steam
            ],
        ];
        $product->status = 'active';
        $product->published_at = now();
        $product->variants_count = 1;
        $product->save();

        $verb = $existing ? 'обновлён' : 'создан';
        $this->info("✓ Товар «Пополнение Steam» {$verb}");
        $this->line("  id={$product->id}, slug={$product->slug}");
        $this->line("  категория: #{$category->id} ({$category->slug})");
        $this->line("  диапазон: {$min}–{$max} ₽, наценка: {$markup}%");
        return 0;
    }
}
