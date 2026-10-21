<?php

declare(strict_types=1);

namespace Napelem\Controller;

use Napelem\Http\Input;
use Napelem\Http\Json;
use Napelem\Service\ProjectService;
use Napelem\Support\Validator;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class ProjectController
{
    public function __construct(private readonly ProjectService $projects)
    {
    }

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return Json::send($response, $this->projects->list(
            Input::queryInt($request, 'id'),
            Input::queryString($request, 'status')
        ));
    }

    public function create(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $id = $this->projects->create(Input::body($request), self::user($request));

        return Json::send($response, [
            'success' => true,
            'message' => 'Projekt sikeresen létrehozva!',
            'id' => $id,
            'status' => 'New',
        ], 201);
    }

    public function update(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $id = Validator::int(Input::queryInt($request, 'id'), 'id', 1);
        $result = $this->projects->update($id, Input::body($request), self::user($request));
        $message = $result['upgraded']
            ? 'Minden alkatrész elérhető, a projekt ütemezett (Scheduled) állapotba került.'
            : 'Projekt sikeresen módosítva!';

        return Json::send($response, [
            'success' => true,
            'message' => $message,
            'id' => $result['id'],
            'status' => $result['status'],
        ]);
    }

    public function delete(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $id = Validator::int(Input::queryInt($request, 'id'), 'id', 1);
        $this->projects->delete($id, self::user($request));

        return Json::send($response, [
            'success' => true,
            'message' => 'Projekt sikeresen törölve!',
            'id' => $id,
        ]);
    }

    /** @return array{id:int,username:string,role:string} */
    private static function user(ServerRequestInterface $request): array
    {
        /** @var array{id:int,username:string,role:string} $user */
        $user = $request->getAttribute('user');

        return $user;
    }
}
