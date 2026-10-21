<?php

declare(strict_types=1);

namespace Napelem\Middleware;

use Napelem\Service\AuthService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Bejelentkezés- és szerepkör-ellenőrzés.
 * Üres szereplistánál bármelyik érvényes szerepkörű felhasználó elég.
 */
final class RoleMiddleware implements MiddlewareInterface
{
    /** @param list<string> $roles */
    public function __construct(
        private readonly AuthService $auth,
        private readonly array $roles,
    ) {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $user = $this->auth->requireLogin($this->roles);

        return $handler->handle($request->withAttribute('user', $user));
    }
}
