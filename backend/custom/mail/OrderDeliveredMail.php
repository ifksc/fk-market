<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OrderDeliveredMail extends Mailable
{
    use Queueable, SerializesModels;

    public Order $order;

    public function __construct(public int $orderId)
    {
        $this->order = Order::with('items.product')->findOrFail($orderId);
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "FK.market — заказ {$this->order->public_number} оплачен",
            to: [$this->order->email],
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.order_delivered');
    }
}
