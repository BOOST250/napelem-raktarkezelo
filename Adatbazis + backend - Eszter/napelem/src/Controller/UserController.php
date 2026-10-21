<?php

declare(strict_types=1);

namespace Napelem\Controller;

use Napelem\Http\Input;
use Napelem\Http\Json;
use Napelem\Service\UserService;
use Napelem\Support\Validator;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class UserController
{
    public function __construct(private readonly UserService $users)
    {
    }

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        unset($request);

        return Json::send($response, $this->users->list());
    }

    public function create(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $id = $this->users->create(Input::body($request));

        return Json::send($response, [
            'success' => true,
            'message' => 'Felhasználó sikeresen létrehozva!',
            'id' => $id,
        ], 201);
    }

    public function update(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $id = Validator::int(Input::queryInt($request, 'id'), 'id', 1);
        $this->users->update($id, Input::body($request), self::user($request));

        return Json::send($response, [
            'success' => true,
            'message' => 'Felhasználó sikeresen módosítva!',
            'id' => $id,
        ]);
    }

    public function delete(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $id = Validator::int(Input::queryInt($request, 'id'), 'id', 1);
        $this->users->delete($id, self::user($request));

        return Json::send($response, [
            'success' => true,
            'message' => 'Felhasználó sikeresen törölve!',
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
