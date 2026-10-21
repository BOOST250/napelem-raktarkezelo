<?php

declare(strict_types=1);

namespace Napelem\Controller;

use Napelem\Http\Json;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class MetaController
{
    public function root(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        unset($request);

        return Json::send($response, [
            'nev' => 'Napelem API',
            'framework' => 'Slim 4',
            'dokumentacio' => 'API.md',
        ]);
    }
}
