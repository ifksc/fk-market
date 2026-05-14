<?php

namespace App\Mail;

use App\Models\EmailVerification;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class VerifyEmailMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $code;
    public string $userName;

    public function __construct(public int $verificationId)
    {
        $v = EmailVerification::with('user')->findOrFail($verificationId);
        $email = $v->new_email ?: $v->user->email;
        $this->code = (string) $v->code;
        $this->userName = $v->user->name ?: $email;
    }

    public function envelope(): Envelope
    {
        $v = EmailVerification::findOrFail($this->verificationId);
        $to = $v->new_email ?: $v->user->email;
        return new Envelope(
            subject: 'FK.market — подтверждение почты',
            to: [$to],
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.verify_email');
    }
}
