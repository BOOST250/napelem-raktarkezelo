<?php

declare(strict_types=1);

/**
 * Slim 4 belépő. A régi api/*.php fájlok ide továbbítanak, az URL nem változik.
 * A basePath a mappából számolódik, nem localhostból, ezért IP-címről is elérhető.
 */

if (defined('NAPELEM_API_BOOTED')) {
    return;
}
define('NAPELEM_API_BOOTED', true);

$autoload = dirname(__DIR__) . '/vendor/autoload.php';
if (!is_file($autoload)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(
        ['error' => 'Hiányzik a vendor mappa. A napelem mappában futtasd: composer install'],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

require $autoload;

Napelem\Kernel::run();
