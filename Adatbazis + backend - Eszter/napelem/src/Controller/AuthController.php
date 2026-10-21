<?php

declare(strict_types=1);

namespace Napelem\Controller;

use Napelem\Http\ApiException;
use Napelem\Http\Input;
use Napelem\Http\Json;
use Napelem\Service\AuthService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AuthController
{
    public function __construct(private readonly AuthService $auth)
    {
    }

    public function login(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = Input::body($request);
        $user = $this->auth->login((string) ($body['username'] ?? ''), (string) ($body['password'] ?? ''));

        return Json::send($response, ['success' => true, 'user' => $user]);
    }

    public function logout(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        unset($request);
        $this->auth->logout();

        return Json::send($response, ['ok' => true]);
    }

    public function me(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        unset($request);
        $user = $this->auth->currentUser();
        if ($user === null) {
            throw new ApiException(401, 'Nincs bejelentkezve.');
        }

        return Json::send($response, ['user' => $user]);
    }
}
