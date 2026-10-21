<?php

declare(strict_types=1);

namespace Napelem\Controller;

use Napelem\Http\ApiException;
use Napelem\Http\Input;
use Napelem\Http\Json;
use Napelem\Repository\HistoryRepository;
use Napelem\Repository\ProjectRepository;
use Napelem\Support\Validator;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class HistoryController
{
    public function __construct(
        private readonly HistoryRepository $history,
        private readonly ProjectRepository $projects,
    ) {
    }

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $projectId = Input::queryInt($request, 'project_id');
        $rows = [];
        foreach ($this->history->list($projectId, false) as $row) {
            $rows[] = $this->present($row);
        }

        return Json::send($response, $rows);
    }

    public function structured(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $projectId = Input::queryInt($request, 'project_id', 'projekt_id');
        if ($projectId === null || $projectId < 1) {
            throw new ApiException(400, 'Hiányzó vagy érvénytelen project_id.');
        }
        $project = $this->projects->find($projectId);
        if ($project === null) {
            throw new ApiException(404, 'Nincs ilyen projekt.');
        }
        $events = [];
        foreach ($this->history->list($projectId, true) as $row) {
            $events[] = [
                'id' => (int) $row['id'],
                'status' => (string) $row['status'],
                'statusz' => (string) $row['status'],
                'changed_at' => $row['changed_at'],
                'mikor' => $row['changed_at'],
                'user_id' => $row['user_id'] === null ? null : (int) $row['user_id'],
                'username' => $row['username'],
            ];
        }

        return Json::send($response, [
            'projekt_id' => $projectId,
            'project_id' => $projectId,
            'aktualis_statusz' => (string) $project['status'],
            'status' => (string) $project['status'],
            'naplo' => $events,
        ]);
    }

    public function delete(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $id = Validator::int(Input::queryInt($request, 'id'), 'id', 1);
        if ($this->history->delete($id) < 1) {
            throw new ApiException(404, 'Nincs ilyen naplóbejegyzés.');
        }

        return Json::send($response, [
            'success' => true,
            'message' => 'Naplóbejegyzés törölve!',
            'id' => $id,
        ]);
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function present(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'project_id' => (int) $row['project_id'],
            'status' => (string) $row['status'],
            'changed_at' => $row['changed_at'],
            'user_id' => $row['user_id'] === null ? null : (int) $row['user_id'],
            'username' => $row['username'],
        ];
    }
}
