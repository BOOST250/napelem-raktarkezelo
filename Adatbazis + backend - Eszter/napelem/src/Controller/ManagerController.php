<?php

declare(strict_types=1);

namespace Napelem\Controller;

use Napelem\Http\Input;
use Napelem\Http\Json;
use Napelem\Service\BinService;
use Napelem\Service\PartService;
use Napelem\Service\StockQueryService;
use Napelem\Support\Validator;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/** Ábel README-szerződése: magyar kulcsok, összesített készlet. */
final class ManagerController
{
    public function __construct(
        private readonly PartService $parts,
        private readonly BinService $bins,
        private readonly StockQueryService $stock,
    ) {
    }

    public function parts(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        unset($request);

        return Json::send($response, $this->parts->listManager());
    }

    public function createPart(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $data = $this->parts->readCreateBody(Input::body($request), true);
        $created = $this->parts->create($data['name'], $data['price'], $data['max']);

        return Json::send($response, $this->parts->managerById((int) $created['id']), 201);
    }

    public function updatePart(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $id = Validator::int($args['id'] ?? null, 'id', 1);
        $this->parts->update($id, $this->parts->readUpdateBody(Input::body($request), true));

        return Json::send($response, $this->parts->managerById($id));
    }

    public function bins(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        unset($request);

        return Json::send($response, $this->bins->listManager());
    }

    public function createBin(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $created = $this->bins->createFromHungarian(Input::body($request));

        return Json::send($response, $this->bins->manager($created), 201);
    }

    public function missing(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        unset($request);

        return Json::send($response, $this->stock->missing());
    }

    public function reserved(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        unset($request);

        return Json::send($response, $this->stock->reserved());
    }
}
