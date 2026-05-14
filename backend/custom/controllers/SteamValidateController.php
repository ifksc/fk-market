<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Provider;
use App\Services\Providers\FkwalletProductsGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Публичный эндпоинт для валидации Steam-логина — фронт дёргает его с debounce
 * при вводе поля в форме покупки. На бэке стоит rate-limit (см. routes/api.php),
 * чтобы не дать заспамить FK.
 */
class SteamValidateController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'login' => ['required', 'string', 'max:100'],
        ]);

        $provider = Provider::where('code', 'fkwallet')->first();
        if (!$provider || !$provider->is_enabled) {
            return response()->json(['data' => ['is_valid' => false, 'reason' => 'provider_disabled']], 200);
        }

        $gateway = FkwalletProductsGateway::fromConfig($provider->id);
        $isValid = $gateway->validateSteamAccount($data['login']);

        return response()->json(['data' => ['is_valid' => $isValid]]);
    }
}
