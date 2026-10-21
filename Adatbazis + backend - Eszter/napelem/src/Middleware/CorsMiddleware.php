<?php

declare(strict_types=1);

namespace Napelem\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Response;

/**
 * CORS a session-cookie-hoz. A "*" origin credentials mellett nem használható,
 * ezért a kérés http(s) originjét tükrözzük vissza: így a felület localhoston,
 * gépen IP-címről és helyi hálózatról is hívhatja az API-t. A sütő SameSite=Lax,
 * domain nélkül, ezért idegen weboldal a fetch-csel nem kapja meg.
 */
final class CorsMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if (strtoupper($request->getMethod()) === 'OPTIONS') {
            return $this->apply($request, (new Response())->withStatus(204));
        }

        return $this->apply($request, $handler->handle($request));
    }

    public static function httpOrigin(string $origin): bool
    {
        return $origin !== '' && preg_match(
            '~^https?://([A-Za-z0-9.-]+|\[[0-9A-Fa-f:]+\])(:\d+)?$~',
            $origin
        ) === 1;
    }

    private function apply(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $origin = $request->getHeaderLine('Origin');
        if (self::httpOrigin($origin)) {
            $response = $response
                ->withHeader('Access-Control-Allow-Origin', $origin)
                ->withHeader('Access-Control-Allow-Credentials', 'true')
                ->withHeader('Vary', 'Origin');
        } else {
            $response = $response->withHeader('Access-Control-Allow-Origin', '*');
        }

        return $response
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
            ->withHeader('Access-Control-Max-Age', '86400');
    }
}
