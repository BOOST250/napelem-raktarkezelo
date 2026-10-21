<?php

declare(strict_types=1);

namespace Napelem\Http;

use Psr\Http\Message\ResponseInterface;
use Slim\Psr7\Response;

/** Egységes JSON-válasz. A felületek az `error` kulcsot olvassák hiba esetén. */
final class Json
{
    public static function send(ResponseInterface $response, mixed $data, int $status = 200): ResponseInterface
    {
        $response->getBody()->write(json_encode(
            $data,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        ));

        return $response
            ->withStatus($status)
            ->withHeader('Content-Type', 'application/json; charset=utf-8');
    }

    public static function error(int $status, string $message): ResponseInterface
    {
        return self::send(new Response(), ['error' => $message], $status);
    }
}
