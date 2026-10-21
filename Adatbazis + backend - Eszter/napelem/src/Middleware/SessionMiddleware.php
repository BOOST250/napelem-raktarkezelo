<?php

declare(strict_types=1);

namespace Napelem\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * PHP-munkamenet. Ugyanaz a süti, mint az api/auth.php-ben (PHPSESSID).
 * Domain szándékosan nincs beállítva: a süti ahhoz a hoszthoz kötődik, ahonnan
 * a böngésző az oldalt megnyitotta (localhost vagy a gép IP-címe egyaránt).
 */
final class SessionMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        self::start();

        return $handler->handle($request);
    }

    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        ]);
        session_start();
    }
}
