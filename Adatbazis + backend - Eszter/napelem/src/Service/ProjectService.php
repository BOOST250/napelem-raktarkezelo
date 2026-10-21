<?php

declare(strict_types=1);

namespace Napelem\Service;

use Napelem\Database\ConnectionFactory;
use Napelem\Domain\ProjectStatus;
use Napelem\Domain\Role;
use Napelem\Http\ApiException;
use Napelem\Repository\HistoryRepository;
use Napelem\Repository\ProjectRepository;
use Napelem\Support\Validator;

final class ProjectService
{
    public function __construct(
        private readonly ConnectionFactory $db,
        private readonly ProjectRepository $projects,
        private readonly HistoryRepository $history,
        private readonly ReservationService $reservations,
    ) {
    }

    /** @return list<array<string, mixed>> */
    public function list(?int $id = null, ?string $status = null): array
    {
        if ($status !== null && !ProjectStatus::isValid($status)) {
            throw new ApiException(400, 'Érvénytelen projektállapot.');
        }
        $rows = [];
        foreach ($this->projects->all($id, $status) as $row) {
            $rows[] = $this->present($row);
        }

        return $rows;
    }

    /** @param array<string, mixed> $body @param array{id:int,username:string,role:string} $user */
    public function create(array $body, array $user): int
    {
        $location = Validator::requiredString($body, 'location', 255, 'location');
        $customer = Validator::requiredString($body, 'customer_name', 100, 'customer_name');
        $description = Validator::optionalString($body, 'description', 5000, 'description');
        $email = Validator::email(Validator::optionalString($body, 'customer_email', 100, 'customer_email'));
        $phone = Validator::phone(Validator::optionalString($body, 'customer_phone', 20, 'customer_phone'));

        return $this->db->transaction(function () use ($location, $description, $customer, $email, $phone, $user) {
            $id = $this->projects->insert($location, $description, $customer, $email, $phone);
            $this->history->add($id, ProjectStatus::NEW, (int) $user['id']);

            return $id;
        });
    }

    /**
     * @param array<string, mixed> $body
     * @param array{id:int,username:string,role:string} $user
     * @return array{id:int,status:string,upgraded:bool}
     */
    public function update(int $id, array $body, array $user): array
    {
        return $this->db->transaction(function () use ($id, $body, $user) {
            $current = $this->projects->findForUpdate($id);
            if ($current === null) {
                throw new ApiException(404, 'Nincs ilyen projekt.');
            }

            $role = $user['role'];
            $status = (string) $current['status'];
            $closed = in_array($status, [ProjectStatus::COMPLETED, ProjectStatus::FAILED], true);
            if ($closed && $role !== Role::ADMIN) {
                throw new ApiException(409, 'A lezárt projekt már nem módosítható.');
            }

            $fields = $this->scalarFields($body);
            $requested = null;
            $upgraded = false;
            if (array_key_exists('status', $body)) {
                $requested = (string) $body['status'];
                if (!ProjectStatus::isValid($requested)) {
                    throw new ApiException(400, 'Érvénytelen projektállapot.');
                }
                if ($requested !== $status) {
                    if ($role !== Role::ADMIN && !ProjectStatus::specialistCan($status, $requested)) {
                        throw new ApiException(409, "A(z) $status állapotból nem lehet $requested állapotba lépni.");
                    }
                    if ($requested === ProjectStatus::WAIT && $status === ProjectStatus::DRAFT) {
                        if ($this->reservations->demandCount($id) < 1) {
                            throw new ApiException(400, 'Legalább egy alkatrészigény kell, mielőtt a raktárnak leadod.');
                        }
                        $this->reservations->reserveWholeProject($id);
                        if ($this->reservations->isFullyReserved($id)) {
                            $requested = ProjectStatus::SCHEDULED;
                            $upgraded = true;
                        }
                    }
                    $fields['status'] = $requested;
                }
            }

            if ($fields === []) {
                throw new ApiException(400, 'Nincs módosítandó mező.');
            }

            $this->projects->updateFields($id, $fields);
            $final = (string) ($fields['status'] ?? $status);
            if (isset($fields['status'])) {
                $this->history->add($id, $final, (int) $user['id']);
            }

            return ['id' => $id, 'status' => $final, 'upgraded' => $upgraded];
        });
    }

    /** @param array{id:int,username:string,role:string} $user */
    public function delete(int $id, array $user): void
    {
        $current = $this->projects->find($id);
        if ($current === null) {
            throw new ApiException(404, 'Nincs ilyen projekt.');
        }
        $status = (string) $current['status'];
        if ($user['role'] !== Role::ADMIN && !in_array($status, [ProjectStatus::NEW, ProjectStatus::DRAFT], true)) {
            throw new ApiException(409, 'Csak új vagy tervezet projekt törölhető.');
        }
        $this->projects->delete($id);
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    public function present(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'location' => (string) $row['location'],
            'description' => $row['description'],
            'customer_name' => (string) $row['customer_name'],
            'customer_email' => $row['customer_email'],
            'customer_phone' => $row['customer_phone'],
            'status' => (string) $row['status'],
            'work_hours' => $row['work_hours'] === null ? null : (float) $row['work_hours'],
            'labor_cost' => $row['labor_cost'] === null ? null : (float) $row['labor_cost'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    public static function displayName(array $project): string
    {
        $name = trim((string) ($project['customer_name'] ?? '') . ' – ' . (string) ($project['location'] ?? ''));

        return $name !== '' && $name !== '–' ? $name : '#' . (int) $project['id'];
    }

    /** @param array<string, mixed> $body @return array<string, mixed> */
    private function scalarFields(array $body): array
    {
        $fields = [];
        if (array_key_exists('location', $body)) {
            $fields['location'] = Validator::requiredString($body, 'location', 255, 'location');
        }
        if (array_key_exists('description', $body)) {
            $fields['description'] = Validator::optionalString($body, 'description', 5000, 'description');
        }
        if (array_key_exists('customer_name', $body)) {
            $fields['customer_name'] = Validator::requiredString($body, 'customer_name', 100, 'customer_name');
        }
        if (array_key_exists('customer_email', $body)) {
            $fields['customer_email'] = Validator::email(
                Validator::optionalString($body, 'customer_email', 100, 'customer_email')
            );
        }
        if (array_key_exists('customer_phone', $body)) {
            $fields['customer_phone'] = Validator::phone(
                Validator::optionalString($body, 'customer_phone', 20, 'customer_phone')
            );
        }
        if (array_key_exists('work_hours', $body)) {
            $fields['work_hours'] = $this->optionalNumber($body['work_hours'], 'work_hours', 999.99);
        }
        if (array_key_exists('labor_cost', $body)) {
            $fields['labor_cost'] = $this->optionalNumber($body['labor_cost'], 'labor_cost', 99999999.99);
        }

        return $fields;
    }

    private function optionalNumber(mixed $value, string $label, float $max): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        $number = Validator::money($value, $label);
        if ($number > $max) {
            throw new ApiException(400, "A(z) $label legfeljebb $max lehet.");
        }

        return $number;
    }
}
