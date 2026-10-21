<?php

declare(strict_types=1);

namespace Napelem\Controller;

use Napelem\Http\Input;
use Napelem\Http\Json;
use Napelem\Service\BinService;
use Napelem\Support\Validator;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class BinController
{
    public function __construct(private readonly BinService $bins)
    {
    }

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return Json::send($response, $this->bins->listRaw(
            Input::queryInt($request, 'id'),
            Input::queryInt($request, 'part_id')
        ));
    }

    public function create(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $created = $this->bins->createFromLegacy(Input::body($request));

        return Json::send($response, [
            'success' => true,
            'message' => 'Rekesz sikeresen létrehozva!',
            'id' => (int) $created['id'],
        ], 201);
    }

    public function update(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $id = Validator::int(Input::queryInt($request, 'id'), 'id', 1);
        $this->bins->update($id, Input::body($request));

        return Json::send($response, [
            'success' => true,
            'message' => 'Rekesz sikeresen módosítva!',
            'id' => $id,
        ]);
    }

    public function delete(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $id = Validator::int(Input::queryInt($request, 'id'), 'id', 1);
        $this->bins->delete($id);

        return Json::send($response, [
            'success' => true,
            'message' => 'Rekesz sikeresen törölve!',
            'id' => $id,
        ]);
    }
}
