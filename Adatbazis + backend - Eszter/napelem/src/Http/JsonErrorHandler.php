<?php

declare(strict_types=1);

namespace Napelem\Http;

use PDOException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpMethodNotAllowedException;
use Slim\Exception\HttpNotFoundException;
use Throwable;

/**
 * Minden kivételt `{"error":"..."}` JSON-ná alakít, a megfelelő HTTP-kóddal.
 * Az SQL-szöveget nem adjuk ki a kliensnek.
 */
final class JsonErrorHandler
{
    public function __invoke(
        ServerRequestInterface $request,
        Throwable $exception,
        bool $displayErrorDetails,
        bool $logErrors,
        bool $logErrorDetails,
    ): ResponseInterface {
        unset($request, $displayErrorDetails, $logErrors, $logErrorDetails);

        if ($exception instanceof ApiException) {
            return Json::error($exception->status(), $exception->getMessage());
        }

        if ($exception instanceof HttpBadRequestException) {
            return Json::error(400, 'Érvénytelen JSON.');
        }

        if ($exception instanceof HttpNotFoundException) {
            return Json::error(404, 'Nincs ilyen végpont.');
        }

        if ($exception instanceof HttpMethodNotAllowedException) {
            $response = Json::error(405, 'Nem támogatott metódus.');
            $allowed = $exception->getAllowedMethods();
            if ($allowed !== []) {
                return $response->withHeader('Allow', implode(', ', $allowed));
            }

            return $response;
        }

        error_log($exception::class . ': ' . $exception->getMessage());

        if ($exception instanceof PDOException) {
            $state = (string) ($exception->errorInfo[0] ?? $exception->getCode());
            if ($state === '42S02' || str_contains($exception->getMessage(), 'issued_quantity')
                || str_contains($exception->getMessage(), 'stock_movements')) {
                return Json::error(
                    500,
                    'Az adatbázis séma nem teljes. Importáld a napelemrendszer.sql fájlt, utána a napelemrendszer_illesztes.sql fájlt.'
                );
            }

            return Json::error(500, 'Adatbázis hiba.');
        }

        return Json::error(500, 'Váratlan szerverhiba.');
    }
}
