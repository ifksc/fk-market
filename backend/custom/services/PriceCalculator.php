<?php

namespace App\Services;

use App\Models\PricingRule;
use App\Models\Product;

class PriceCalculator
{
    /**
     * Рассчитать витринную цену для товара исходя из price_base, индивидуальной markup_pct
     * или применимого pricing_rule (по убыванию специфичности).
     */
    public static function compute(Product $product): float
    {
        $markup = $product->markup_pct;

        if ($markup === null) {
            $rule = PricingRule::resolveFor($product);
            $markup = $rule?->markup_pct ?? 0;
        }

        $price = (float) $product->price_base * (1 + (float) $markup / 100);
        return round($price, 2);
    }
}
