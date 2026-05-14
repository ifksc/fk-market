<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Seller;
use App\Models\Setting;
use App\Models\StockItem;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedSettings();
        $this->seedAdmin();
        $platform = $this->seedPlatformSeller();
        $this->seedPricingRules();
        $categories = $this->seedCategories();
        $this->seedProducts($platform, $categories);
        $this->command->info('✓ Посевные данные загружены: категорий ' . Category::count() . ', товаров ' . Product::count());
    }

    private function seedSettings(): void
    {
        $defaults = [
            ['site_name', 'FK.market', 'string'],
            ['site_email', 'no-reply@fk.market', 'string'],
            ['currency', 'RUB', 'string'],
            ['global_markup_pct', '22', 'int'],
            ['order_sla_minutes_manual', '240', 'int'],
            ['payment_hold_minutes', '60', 'int'],
        ];
        foreach ($defaults as [$k, $v, $t]) {
            Setting::updateOrCreate(['key' => $k], ['value' => $v, 'type' => $t]);
        }
    }

    private function seedAdmin(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@fk.market'],
            [
                'name' => 'Admin',
                'role' => 'admin',
                'password' => Hash::make('admin123'),
                'email_verified_at' => now(),
            ],
        );
    }

    private function seedPlatformSeller(): Seller
    {
        return Seller::updateOrCreate(
            ['slug' => 'platform'],
            [
                'display_name' => 'FK.market (платформа)',
                'legal_type' => 'platform',
                'commission_pct' => 0,
                'status' => 'active',
                'verified_at' => now(),
            ],
        );
    }

    private function seedPricingRules(): void
    {
        PricingRule::updateOrCreate(
            ['scope' => 'global', 'scope_id' => null],
            ['markup_pct' => 22, 'priority' => 0, 'is_active' => true],
        );
    }

    /** @return array<string, Category> */
    private function seedCategories(): array
    {
        $data = [
            ['ai',       'ИИ-аккаунты',   'brain-circuit', 1],
            ['vpn',      'VPN',           'shield',        2],
            ['skins',    'Скины Steam',   'package',       3],
            ['keys',     'Ключи игр',     'key',           4],
            ['subs',     'Подписки',      'play-circle',   5],
            ['accounts', 'Аккаунты',      'user',          6],
            ['services', 'Услуги',        'zap',           7],
        ];
        $map = [];
        foreach ($data as [$slug, $name, $icon, $sort]) {
            $map[$slug] = Category::updateOrCreate(['slug' => $slug], [
                'name' => $name,
                'icon' => $icon,
                'sort_order' => $sort,
                'is_active' => true,
            ]);
        }
        return $map;
    }

    private function seedProducts(Seller $seller, array $cats): void
    {
        // Формат: [slug, name, short, price_base, price_final, price_old, cat_slug, mode, stock_keys, params, isNew, isHot]
        $products = [
            // --- ИИ-аккаунты ---
            ['chatgpt-plus-1mo', 'ChatGPT Plus · 1 месяц (личный аккаунт)',
             'Личный аккаунт ChatGPT Plus на 1 месяц с доступом к GPT-4o, GPTs и расширенному лимиту.',
             1150, 1490, null, 'ai', 'stock', [
                 'chatgpt-user-01@proton.me:Pass_A7xQ2_!Fk',
                 'chatgpt-user-02@proton.me:Pass_B9kM5_!Fk',
                 'chatgpt-user-03@proton.me:Pass_C2tL8_!Fk',
             ], null, true, false],

            ['claude-pro-1mo', 'Claude Pro · 1 месяц',
             'Подписка Claude Pro с доступом к Claude Opus и большим лимитом сообщений.',
             1280, 1690, null, 'ai', 'stock', [
                 'claude-01@proton.me:AntX_91f_!Pr',
                 'claude-02@proton.me:AntY_54k_!Pr',
             ], null, true, false],

            ['midjourney-standard-1mo', 'Midjourney Standard · 1 месяц',
             '15 часов генерации в месяц, приватный режим, неограниченная генерация в Relax.',
             1800, 2290, null, 'ai', 'stock', [
                 'mj-01@proton.me:Mj_7n4_!Sd',
                 'mj-02@proton.me:Mj_8k2_!Sd',
             ], null, false, true],

            ['openai-api-5usd', 'OpenAI API · ключ на 5$ кредитов',
             'API-ключ OpenAI с балансом $5 — подходит для pet-project или теста.',
             440, 590, null, 'ai', 'stock', [
                 'sk-openai-AbCdEf1234567890XYZ',
                 'sk-openai-GhIjKl9876543210QWE',
             ], null, true, false],

            // --- VPN ---
            ['nordvpn-premium-1y', 'NordVPN Premium · 1 год',
             'Подписка NordVPN Premium на 12 месяцев. До 6 устройств, 60+ стран, без логов.',
             920, 1290, 1990, 'vpn', 'stock', [
                 'NVPN-1A2B-3C4D-5E6F',
                 'NVPN-9Z8Y-7X6W-5V4U',
                 'NVPN-2Y45-A7XQ-LP9F',
             ], null, false, false],

            ['expressvpn-1y', 'ExpressVPN · 12 месяцев',
             'Один из самых быстрых VPN — лицензия на 12 месяцев, 5 устройств.',
             2800, 3490, null, 'vpn', 'stock', ['EXP-AAAA-BBBB','EXP-CCCC-DDDD'], null, false, false],

            // --- Подписки ---
            ['spotify-family-1y', 'Spotify Premium Family · 12 мес',
             'Семейная подписка Spotify на 12 месяцев, до 6 аккаунтов.',
             650, 990, null, 'subs', 'stock', [
                 'invite:https://spotify.com/family/invite/ABCXYZ1',
                 'invite:https://spotify.com/family/invite/DEFXYZ2',
             ], [
                 ['name' => 'spotify_email', 'label' => 'Email Spotify-аккаунта', 'type' => 'email', 'required' => true],
             ], false, false],

            ['steam-topup-500', 'Steam пополнение 500 ₽',
             'Пополнение баланса Steam на 500 рублей. Зачисление 5-30 минут.',
             500, 550, null, 'subs', 'api', [], [
                 ['name' => 'steam_login', 'label' => 'Логин Steam', 'type' => 'string', 'required' => true],
             ], false, false],

            // --- Скины Steam ---
            ['ak47-redline-ft', 'AK-47 Redline · Field-Tested (CS2)',
             'Популярный скин AK-47 Redline в качестве Field-Tested. Отправка трейдом.',
             3100, 3450, null, 'skins', 'manual', [], [
                 ['name' => 'steam_trade_url', 'label' => 'Steam Trade URL', 'type' => 'url', 'required' => true],
             ], false, true],

            // --- Ключи игр ---
            ['cyberpunk-phantom-liberty', 'Cyberpunk 2077: Phantom Liberty',
             'Steam-ключ DLC Phantom Liberty. Активация в Steam → Activate a Product.',
             1820, 2190, null, 'keys', 'stock', [
                 'CPK-PLIB-AAAA-BBBB-CCCC',
                 'CPK-PLIB-DDDD-EEEE-FFFF',
             ], null, true, false],

            // --- Услуги ---
            ['telegram-subs-1000', 'Накрутка подписчиков Telegram · 1 000',
             '1 000 подписчиков в ваш Telegram-канал или группу. Исполнение 24-48 часов.',
             300, 390, null, 'services', 'manual', [], [
                 ['name' => 'channel', 'label' => 'Ссылка на канал или @username', 'type' => 'string', 'required' => true],
             ], false, false],
        ];

        foreach ($products as [$slug, $name, $short, $priceBase, $priceFinal, $priceOld, $catSlug, $mode, $keys, $params, $isNew, $isHot]) {
            $p = Product::updateOrCreate(['slug' => $slug], [
                'seller_id' => $seller->id,
                'category_id' => $cats[$catSlug]->id,
                'name' => $name,
                'short_description' => $short,
                'description' => $short . "\n\nДополнительное описание можно отредактировать в админке.",
                'price_base' => $priceBase,
                'price_final' => $priceFinal,
                'price_old' => $priceOld,
                'currency' => 'RUB',
                'fulfillment_mode' => $mode,
                'fulfillment_fallback' => $mode === 'api' ? 'manual' : 'none',
                'required_params' => $params,
                'status' => 'active',
                'published_at' => now(),
                'stock_available' => $mode === 'stock' ? count($keys) : null,
                'rating' => 4.7 + mt_rand(0, 3) / 10,
                'reviews_count' => mt_rand(50, 2000),
                'sales_count' => mt_rand(100, 3000),
            ]);

            // Главная картинка-плейсхолдер (используется градиент на фронте, URL пока условный)
            ProductImage::updateOrCreate(
                ['product_id' => $p->id, 'is_primary' => true],
                ['url' => '/placeholders/' . $slug . '.svg', 'sort_order' => 0],
            );

            // Ключи на склад (если fulfillment_mode = stock)
            if ($mode === 'stock' && !empty($keys)) {
                StockItem::where('product_id', $p->id)->delete();
                foreach ($keys as $key) {
                    StockItem::create([
                        'product_id' => $p->id,
                        'payload' => $key, // AsEncryptedString auto-encrypts
                        'note' => 'seeded',
                    ]);
                }
            }
        }
    }
}
