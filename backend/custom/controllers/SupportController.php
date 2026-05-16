<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * POST /api/support — обращение гостя (без аккаунта) по номеру заказа.
 *
 * Гость подтверждает владение заказом парой public_number + email.
 * Залогиненные покупатели создают тикеты через /api/me/support.
 */
class SupportController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'public_number' => ['required', 'string', 'max:32'],
            'email' => ['required', 'email', 'max:190'],
            'kind' => ['required', 'in:code_not_working,wrong_item,other'],
            'subject' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $order = Order::where('public_number', $data['public_number'])->first();
        if (!$order || mb_strtolower((string) $order->email) !== mb_strtolower($data['email'])) {
            return response()->json([
                'message' => 'Заказ с таким номером и email не найден',
            ], 422);
        }

        // user_id берём из заказа: для гостевого заказа он null, для заказа
        // зарегистрированного покупателя — его id (тогда тикет увидит и в ЛК).
        SupportTicket::create([
            'user_id' => $order->user_id,
            'order_id' => $order->id,
            'kind' => $data['kind'],
            'subject' => $data['subject'],
            'body' => $data['body'],
            'status' => 'open',
        ]);

        return response()->json(['data' => ['ok' => true]], 201);
    }
}
