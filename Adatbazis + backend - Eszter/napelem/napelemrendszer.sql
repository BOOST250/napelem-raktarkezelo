-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Gép: 127.0.0.1
-- Létrehozás ideje: 2026. Okt 06. 14:14
-- Kiszolgáló verziója: 10.4.32-MariaDB
-- PHP verzió: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Adatbázis: `napelemrendszer`
--

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `bins`
--

CREATE TABLE `bins` (
  `id` int(11) NOT NULL,
  `row_num` int(11) NOT NULL,
  `col_num` int(11) NOT NULL,
  `level_num` int(11) NOT NULL,
  `identifier` varchar(20) NOT NULL,
  `part_id` int(11) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `max_capacity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `bins`
--

INSERT INTO `bins` (`id`, `row_num`, `col_num`, `level_num`, `identifier`, `part_id`, `quantity`, `max_capacity`) VALUES
(1, 1, 1, 1, 'A1-1', 1, 10, 10),
(2, 1, 2, 1, 'A1-2', 2, 3, 5),
(3, 2, 1, 1, 'B1-1', 3, 15, 20),
(4, 2, 2, 1, 'B1-2', 4, 10, 15);

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `parts`
--

CREATE TABLE `parts` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `max_per_bin` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `parts`
--

INSERT INTO `parts` (`id`, `name`, `price`, `max_per_bin`, `created_at`, `updated_at`) VALUES
(1, 'Napelem 400W', 135000.00, 10, '2026-09-16 08:32:06', '2026-09-16 10:06:24'),
(2, 'Inverter 5kW', 250000.00, 5, '2026-09-16 08:32:06', '2026-09-16 08:32:06'),
(3, 'DC kábel 5m', 8000.00, 20, '2026-09-16 08:32:06', '2026-09-16 08:32:06'),
(4, 'Konzol csomag', 35000.00, 15, '2026-09-16 08:32:06', '2026-09-16 08:32:06');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `projects`
--

CREATE TABLE `projects` (
  `id` int(11) NOT NULL,
  `location` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `customer_name` varchar(100) NOT NULL,
  `customer_email` varchar(100) DEFAULT NULL,
  `customer_phone` varchar(20) DEFAULT NULL,
  `status` enum('New','Draft','Wait','Scheduled','InProgress','Completed','Failed') NOT NULL DEFAULT 'New',
  `work_hours` decimal(5,2) DEFAULT NULL,
  `labor_cost` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `projects`
--

INSERT INTO `projects` (`id`, `location`, `description`, `customer_name`, `customer_email`, `customer_phone`, `status`, `work_hours`, `labor_cost`, `created_at`, `updated_at`) VALUES
(1, 'Budapest, Kossuth u. 15', 'Családi ház napelem rendszer', 'Kiss Péter', NULL, NULL, 'Draft', 8.50, 85000.00, '2026-09-15 11:15:42', '2026-09-16 09:16:21'),
(3, 'Győr, Baross u. 7', 'Iskola napelem', 'Győri Iskola', NULL, NULL, 'New', NULL, NULL, '2026-09-16 09:18:19', '2026-09-16 09:18:19'),
(4, 'Teszt utca 1', 'Teszt projekt', 'Teszt Elek', NULL, NULL, 'Draft', NULL, NULL, '2026-09-16 10:32:52', '2026-09-16 10:36:54');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `project_history`
--

CREATE TABLE `project_history` (
  `id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `status` varchar(20) NOT NULL,
  `changed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `project_history`
--

INSERT INTO `project_history` (`id`, `project_id`, `status`, `changed_at`) VALUES
(2, 4, 'New', '2026-09-16 10:32:52'),
(3, 4, 'Draft', '2026-09-16 10:36:54');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `project_parts`
--

CREATE TABLE `project_parts` (
  `project_id` int(11) NOT NULL,
  `part_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `reserved` tinyint(1) NOT NULL DEFAULT 0,
  `reserved_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('szakember','raktarvezeto','raktaros') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

--
-- A tábla adatainak kiíratása `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `role`, `created_at`) VALUES
(1, 'szakember1', 'A12346', 'raktarvezeto', '2026-09-16 08:23:32'),
(2, 'raktarvezeto1', 'Z12356', 'raktarvezeto', '2026-09-16 08:23:32'),
(3, 'raktaros1', 'U23456', 'raktaros', '2026-09-16 08:23:32');

--
-- Indexek a kiírt táblákhoz
--

--
-- A tábla indexei `bins`
--
ALTER TABLE `bins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `identifier` (`identifier`),
  ADD KEY `part_id` (`part_id`);

--
-- A tábla indexei `parts`
--
ALTER TABLE `parts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- A tábla indexei `projects`
--
ALTER TABLE `projects`
  ADD PRIMARY KEY (`id`);

--
-- A tábla indexei `project_history`
--
ALTER TABLE `project_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `project_id` (`project_id`);

--
-- A tábla indexei `project_parts`
--
ALTER TABLE `project_parts`
  ADD PRIMARY KEY (`project_id`,`part_id`),
  ADD KEY `part_id` (`part_id`);

--
-- A tábla indexei `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- A kiírt táblák AUTO_INCREMENT értéke
--

--
-- AUTO_INCREMENT a táblához `bins`
--
ALTER TABLE `bins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT a táblához `parts`
--
ALTER TABLE `parts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT a táblához `projects`
--
ALTER TABLE `projects`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT a táblához `project_history`
--
ALTER TABLE `project_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT a táblához `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Megkötések a kiírt táblákhoz
--

--
-- Megkötések a táblához `bins`
--
ALTER TABLE `bins`
  ADD CONSTRAINT `bins_ibfk_1` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`) ON DELETE SET NULL;

--
-- Megkötések a táblához `project_history`
--
ALTER TABLE `project_history`
  ADD CONSTRAINT `project_history_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE;

--
-- Megkötések a táblához `project_parts`
--
ALTER TABLE `project_parts`
  ADD CONSTRAINT `project_parts_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `project_parts_ibfk_2` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
