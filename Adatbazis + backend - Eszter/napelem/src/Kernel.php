<?php

declare(strict_types=1);

namespace Napelem;

use Napelem\Controller\AuthController;
use Napelem\Controller\BinController;
use Napelem\Controller\HistoryController;
use Napelem\Controller\ManagerController;
use Napelem\Controller\MetaController;
use Napelem\Controller\PartController;
use Napelem\Controller\ProjectController;
use Napelem\Controller\ProjectPartController;
use Napelem\Controller\ReceivingController;
use Napelem\Controller\UserController;
use Napelem\Controller\WorkerController;
use Napelem\Database\ConnectionFactory;
use Napelem\Domain\Role;
use Napelem\Http\JsonErrorHandler;
use Napelem\Middleware\CorsMiddleware;
use Napelem\Middleware\RoleMiddleware;
use Napelem\Middleware\SessionMiddleware;
use Napelem\Repository\BinRepository;
use Napelem\Repository\HistoryRepository;
use Napelem\Repository\MovementRepository;
use Napelem\Repository\PartRepository;
use Napelem\Repository\ProjectPartRepository;
use Napelem\Repository\ProjectRepository;
use Napelem\Repository\UserRepository;
use Napelem\Service\AuthService;
use Napelem\Service\BinService;
use Napelem\Service\PartService;
use Napelem\Service\PickingService;
use Napelem\Service\ProjectPartService;
use Napelem\Service\ProjectService;
use Napelem\Service\ReceivingService;
use Napelem\Service\ReservationService;
use Napelem\Service\RoutePlanner;
use Napelem\Service\StockQueryService;
use Napelem\Service\UserService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\App;
use Slim\Factory\AppFactory;
use Slim\Factory\ServerRequestCreatorFactory;
use Slim\Routing\RouteCollectorProxy;

/**
 * Slim 4 belépés. A basePath a szkript mappájából jön (pl. /napelem/api),
 * soha nem a localhost hosztnévből, ezért IP-címről ugyanaz az útvonal működik.
 */
final class Kernel
{
    public static function run(): void
    {
        $basePath = self::basePath();
        $app = self::app($basePath);
        $request = ServerRequestCreatorFactory::create()->createServerRequestFromGlobals();
        $response = $app->handle(self::normalize($request, $basePath));
        self::emit($response);
    }

    public static function app(string $basePath): App
    {
        $db = new ConnectionFactory();
        $users = new UserRepository($db);
        $parts = new PartRepository($db);
        $bins = new BinRepository($db);
        $projects = new ProjectRepository($db);
        $lines = new ProjectPartRepository($db);
        $history = new HistoryRepository($db);
        $movements = new MovementRepository($db);

        $authService = new AuthService($users);
        $reservations = new ReservationService($bins, $lines, $projects, $history);
        $partService = new PartService($db, $parts, $bins, $lines);
        $binService = new BinService($bins, $parts);
        $projectService = new ProjectService($db, $projects, $history, $reservations);
        $lineService = new ProjectPartService($db, $lines, $projects, $parts);
        $receiving = new ReceivingService($db, $parts, $bins, $movements, $reservations);
        $stock = new StockQueryService($lines, $movements);
        $picking = new PickingService($db, $projects, $lines, $bins, $history, $movements, new RoutePlanner());

        $auth = new AuthController($authService);
        $part = new PartController($partService);
        $bin = new BinController($binService);
        $project = new ProjectController($projectService);
        $projectPart = new ProjectPartController($lineService);
        $historyController = new HistoryController($history, $projects);
        $user = new UserController(new UserService($users));
        $receive = new ReceivingController($receiving);
        $manager = new ManagerController($partService, $binService, $stock);
        $worker = new WorkerController($picking, $stock);
        $meta = new MetaController();

        $app = AppFactory::create();
        if ($basePath !== '') {
            $app->setBasePath($basePath);
        }

        $app->get('/', [$meta, 'root']);

        $app->post('/login.php', [$auth, 'login']);
        $app->post('/login', [$auth, 'login']);
        $app->post('/logout.php', [$auth, 'logout']);
        $app->post('/logout', [$auth, 'logout']);
        $app->get('/me.php', [$auth, 'me']);
        $app->get('/me', [$auth, 'me']);

        $app->group('', function (RouteCollectorProxy $group) use ($part, $bin, $project, $projectPart, $historyController): void {
            $group->get('/parts.php', [$part, 'index']);
            $group->get('/parts', [$part, 'index']);
            $group->get('/bins.php', [$bin, 'index']);
            $group->get('/bins', [$bin, 'index']);
            $group->get('/projects.php', [$project, 'index']);
            $group->get('/projects', [$project, 'index']);
            $group->get('/project_parts.php', [$projectPart, 'index']);
            $group->get('/project_parts', [$projectPart, 'index']);
            $group->get('/project_history.php', [$historyController, 'index']);
            $group->get('/project_history', [$historyController, 'index']);
        })->add(new RoleMiddleware($authService, Role::ANY));

        $app->group('', function (RouteCollectorProxy $group) use ($part, $bin, $receive): void {
            $group->post('/parts.php', [$part, 'create']);
            $group->post('/parts', [$part, 'create']);
            $group->put('/parts.php', [$part, 'update']);
            $group->put('/parts', [$part, 'update']);
            $group->delete('/parts.php', [$part, 'delete']);
            $group->delete('/parts', [$part, 'delete']);
            $group->post('/bins.php', [$bin, 'create']);
            $group->post('/bins', [$bin, 'create']);
            $group->put('/bins.php', [$bin, 'update']);
            $group->put('/bins', [$bin, 'update']);
            $group->delete('/bins.php', [$bin, 'delete']);
            $group->delete('/bins', [$bin, 'delete']);
            $group->post('/receiving.php', [$receive, 'legacy']);
            $group->post('/receiving', [$receive, 'legacy']);
        })->add(new RoleMiddleware($authService, Role::MANAGER_AREA));

        $app->group('', function (RouteCollectorProxy $group) use ($project, $projectPart): void {
            $group->post('/projects.php', [$project, 'create']);
            $group->post('/projects', [$project, 'create']);
            $group->put('/projects.php', [$project, 'update']);
            $group->put('/projects', [$project, 'update']);
            $group->delete('/projects.php', [$project, 'delete']);
            $group->delete('/projects', [$project, 'delete']);
            $group->post('/project_parts.php', [$projectPart, 'create']);
            $group->post('/project_parts', [$projectPart, 'create']);
            $group->put('/project_parts.php', [$projectPart, 'update']);
            $group->put('/project_parts', [$projectPart, 'update']);
            $group->delete('/project_parts.php', [$projectPart, 'delete']);
            $group->delete('/project_parts', [$projectPart, 'delete']);
        })->add(new RoleMiddleware($authService, Role::SPECIALIST_AREA));

        $app->group('', function (RouteCollectorProxy $group) use ($user, $historyController): void {
            $group->get('/users.php', [$user, 'index']);
            $group->get('/users', [$user, 'index']);
            $group->post('/users.php', [$user, 'create']);
            $group->post('/users', [$user, 'create']);
            $group->put('/users.php', [$user, 'update']);
            $group->put('/users', [$user, 'update']);
            $group->delete('/users.php', [$user, 'delete']);
            $group->delete('/users', [$user, 'delete']);
            $group->delete('/project_history.php', [$historyController, 'delete']);
            $group->delete('/project_history', [$historyController, 'delete']);
        })->add(new RoleMiddleware($authService, [Role::ADMIN]));

        $app->group('', function (RouteCollectorProxy $group) use ($manager, $receive): void {
            $group->get('/alkatreszek', [$manager, 'parts']);
            $group->post('/alkatreszek', [$manager, 'createPart']);
            $group->put('/alkatreszek/{id}', [$manager, 'updatePart']);
            $group->get('/rekeszek', [$manager, 'bins']);
            $group->post('/rekeszek', [$manager, 'createBin']);
            $group->post('/bevetelezes', [$receive, 'hungarian']);
            $group->get('/hianyzo', [$manager, 'missing']);
            $group->get('/lefoglalt', [$manager, 'reserved']);
        })->add(new RoleMiddleware($authService, Role::MANAGER_AREA));

        $app->group('', function (RouteCollectorProxy $group) use ($worker): void {
            $group->get('/raktaros_projektek.php', [$worker, 'projects']);
            $group->get('/raktaros/projektek', [$worker, 'projects']);
            $group->post('/raktaros_kivetelezes.php', [$worker, 'begin']);
            $group->post('/raktaros/kivetelezes', [$worker, 'begin']);
            $group->get('/raktaros_helyek.php', [$worker, 'places']);
            $group->get('/raktaros/helyek', [$worker, 'places']);
        })->add(new RoleMiddleware($authService, Role::PICKING));

        $app->group('', function (RouteCollectorProxy $group) use ($worker, $historyController): void {
            $group->get('/raktaros_keszletmozgas.php', [$worker, 'movements']);
            $group->get('/raktaros/keszletmozgas', [$worker, 'movements']);
            $group->get('/projekt_naplo.php', [$historyController, 'structured']);
            $group->get('/projekt-naplo', [$historyController, 'structured']);
        })->add(new RoleMiddleware($authService, Role::WORKER_AREA));

        $app->addBodyParsingMiddleware();
        $app->add(new SessionMiddleware());

        $errors = $app->addErrorMiddleware(false, true, true);
        $errors->setDefaultErrorHandler(new JsonErrorHandler());

        $app->add(new CorsMiddleware());

        return $app;
    }

    /**
     * A /api/index.php/alkatreszek alakú PATH_INFO-t /api/alkatreszek-re írja,
     * hogy a régi fájlnevek és Ábel útvonalai is ugyanahhoz a routerhez jussanak.
     */
    public static function normalize(ServerRequestInterface $request, string $basePath): ServerRequestInterface
    {
        $path = $request->getUri()->getPath();
        $path = preg_replace('#/index\.php(?=/|$)#', '', $path) ?? $path;
        if ($path === '') {
            $path = '/';
        }

        $base = rtrim($basePath, '/');
        if ($base !== '' && $path === $base) {
            $path .= '/';
        }

        return $request->withUri($request->getUri()->withPath($path));
    }

    /** A szkript mappája, hosztnév nélkül. Üres, ha az API a webgyökér. */
    public static function basePath(): string
    {
        $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
        $dir = rtrim(str_replace('\\', '/', dirname($script)), '/');
        if ($dir === '' || $dir === '/' || $dir === '.') {
            return '';
        }

        return $dir;
    }

    private static function emit(ResponseInterface $response): void
    {
        $status = $response->getStatusCode();
        http_response_code($status);
        $reason = $response->getReasonPhrase();
        if ($reason !== '') {
            header(sprintf('HTTP/%s %d %s', $response->getProtocolVersion(), $status, $reason));
        }

        foreach ($response->getHeaders() as $name => $values) {
            foreach ($values as $value) {
                header($name . ': ' . $value, false);
            }
        }

        echo (string) $response->getBody();
    }
}
