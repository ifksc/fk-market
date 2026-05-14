<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ResetPasswordMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $resetUrl;
    public string $userName;

    public function __construct(public int $userId, public string $token)
    {
        $user = User::findOrFail($userId);
        $this->resetUrl = config('app.url') . '/reset-password?token=' . $token . '&email=' . urlencode($user->email);
        $this->userName = $user->name ?: $user->email;
    }

    public function envelope(): Envelope
    {
        $user = User::findOrFail($this->userId);
        return new Envelope(
            subject: 'FK.market — сброс пароля',
            to: [$user->email],
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.reset_password');
    }
}
