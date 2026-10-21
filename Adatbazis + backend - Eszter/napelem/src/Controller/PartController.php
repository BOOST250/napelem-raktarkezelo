<?php

declare(strict_types=1);

namespace Napelem\Controller;

use Napelem\Http\Input;
use Napelem\Http\Json;
use Napelem\Service\PartService;
use Napelem\Support\Validator;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class PartController
{
    public function __construct(private readonly PartService $parts)
    {
    }

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return Json::send($response, $this->parts->listRaw(Input::queryInt($request, 'id')));
    }

    public function create(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $data = $this->parts->readCreateBody(Input::body($request), false);
        $created = $this->parts->create($data['name'], $data['price'], $data['max']);

        return Json::send($response, [
            'success' => true,
            'message' => 'Alkatrész sikeresen létrehozva!',
            'id' => (int) $created['id'],
        ], 201);
    }

    public function update(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $id = Validator::int(Input::queryInt($request, 'id'), 'id', 1);
        $updated = $this->parts->update($id, $this->parts->readUpdateBody(Input::body($request), false));

        return Json::send($response, [
            'success' => true,
            'message' => 'Alkatrész sikeresen módosítva!',
            'id' => (int) $updated['id'],
        ]);
    }

    public function delete(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $id = Validator::int(Input::queryInt($request, 'id'), 'id', 1);
        $this->parts->delete($id);

        return Json::send($response, [
            'success' => true,
            'message' => 'Alkatrész sikeresen törölve!',
            'id' => $id,
        ]);
    }
}
