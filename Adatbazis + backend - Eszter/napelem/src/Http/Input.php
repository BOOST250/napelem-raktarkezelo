<?php

declare(strict_types=1);

namespace Napelem\Http;

use Psr\Http\Message\ServerRequestInterface;

/** JSON-törzs és lekérdezési paraméterek kiolvasása. */
final class Input
{
    /** @return array<string, mixed> */
    public static function body(ServerRequestInterface $request): array
    {
        $stream = $request->getBody();
        if ($stream->isSeekable()) {
            $stream->rewind();
        }
        $raw = (string) $stream;

        $parsed = $request->getParsedBody();
        if (is_array($parsed)) {
            return $parsed;
        }
        if (is_object($parsed)) {
            return (array) $parsed;
        }

        if (trim($raw) === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
            throw new ApiException(400, 'Érvénytelen JSON.');
        }

        return $decoded;
    }

    public static function queryInt(ServerRequestInterface $request, string ...$keys): ?int
    {
        $params = $request->getQueryParams();
        foreach ($keys as $key) {
            if (!array_key_exists($key, $params) || $params[$key] === '' || $params[$key] === null) {
                continue;
            }
            $raw = $params[$key];
            if (is_array($raw) || preg_match('/^-?\d+$/', (string) $raw) !== 1) {
                throw new ApiException(400, "Érvénytelen lekérdezési paraméter: $key.");
            }

            return (int) $raw;
        }

        return null;
    }

    public static function queryString(ServerRequestInterface $request, string $key): ?string
    {
        $params = $request->getQueryParams();
        if (!isset($params[$key]) || $params[$key] === '' || is_array($params[$key])) {
            return null;
        }

        return trim((string) $params[$key]);
    }
}
