-- =====================================================================
--  napelemrendszer_illesztes.sql
--
--  Ezt a fájlt KÖZVETLENÜL a napelemrendszer.sql (Eszter phpMyAdmin
--  exportja, 2026. okt. 6. 14:14) importálása UTÁN kell lefuttatni.
--
--  Miért kell:  a dump 14:14-kor készült, a backend auth-rétege és a
--  receiving.php viszont 14:28–14:38 keltezésű, vagyis a kód KÉSŐBBI a
--  dumpnál, és már az angol szerepkörneveket használja. A dumpban még a
--  régi, magyar enum van, ezért Eszter saját adatbázisán:
--    * a raktárvezető 403-at kap a receiving.php-tól
--      (receiving.php:33  kotelezo_bejelentkezes(['warehouse_manager','admin']))
--    * a users.php POST-ja csendben '' szerepkört ír be, mert a MySQL
--      sql_mode nem strict, így az érvénytelen enum-érték levágódik
--
--  Eszter napelemrendszer.sql fájlja VÁLTOZATLAN marad; minden eltérés
--  itt, egy helyen, kommentelve látható — így Eszter át tudja nézni.
--  EGYEZTETNI ESZTERREL: ha nála már van újabb dump, az övé a mérvadó,
--  és ebből a fájlból csak a tesztadat-blokk kell.
-- =====================================================================

USE `napelemrendszer`;
SET NAMES utf8mb4;


-- ---------------------------------------------------------------------
--  1. SZEREPKÖRNEVEK  (ez az egyetlen szükséges sémaváltozás)
--
--  A backend (receiving.php, auth/Auth.php) és MINDHÁROM frontend az
--  angol értékeket várja:
--    Raktárkezelő felület - Én/raktarvezeto/js/config.js:13
--        ENGEDETT_SZEREPKOR: 'warehouse_manager'
--    Szakemberi Felület - Attila/beadandoszoft/js/config.js:16
--        ENGEDETT_SZEREPKOR: 'specialist'
--  Három lépés, mert enum-értéket nem lehet egy mozdulattal átnevezni:
-- ---------------------------------------------------------------------

-- 1/a  Átmenetileg mindkét névkészlet beleférjen
ALTER TABLE `users` MODIFY `role`
  enum('szakember','raktarvezeto','raktaros',
       'specialist','warehouse_manager','warehouse_worker','admin') NOT NULL;

-- 1/b  A meglévő sorok átképezése (Eszter adatait tartalmilag nem írjuk át,
--      csak a szerepkör nevét fordítjuk le)
UPDATE `users` SET `role` = 'specialist'        WHERE `role` = 'szakember';
UPDATE `users` SET `role` = 'warehouse_manager' WHERE `role` = 'raktarvezeto';
UPDATE `users` SET `role` = 'warehouse_worker'  WHERE `role` = 'raktaros';

-- 1/c  Végleges enum, a kódban szereplő négy értékkel
ALTER TABLE `users` MODIFY `role`
  enum('specialist','warehouse_manager','warehouse_worker','admin') NOT NULL;


-- ---------------------------------------------------------------------
--  2. SZAKEMBER-FIÓK SZEREPKÖRE
--
--  FIGYELEM, ESZTERNEK SZÓLÓ KÉRDÉS: a dumpban a `szakember1` nevű
--  felhasználó szerepköre `raktarvezeto`, vagyis a fenti leképezés után
--  warehouse_manager lenne. Ez elírás: a neve szakemberre utal, és
--  nélküle egyetlen `specialist` fiók sem létezne, vagyis Attila
--  szakemberi felületére senki nem tudna belépni.
--
--  Ezért itt javítjuk `specialist`-re. (Korábban e helyett egy
--  ideiglenes `szakember2` fiók készült; az már nem kell, ezért ha
--  megvan, töröljük. Ha Eszter a saját dumpjában is kijavítja a
--  szerepkört, ez a két sor elhagyható.)
-- ---------------------------------------------------------------------

UPDATE `users` SET `role` = 'specialist' WHERE `username` = 'szakember1';

-- A már nem szükséges ideiglenes szakemberi fiók, illetve a végpontpróba
-- által hátrahagyott szemétsor eltakarítása (ha megvannak)
DELETE FROM `users` WHERE `username` IN ('szakember2', 'proba_user_ideiglenes');


-- ---------------------------------------------------------------------
--  3. TESZTADATOK A BEMUTATÓHOZ
--
--  Eszter dumpja szerkezetileg rendben van, de demózásra kevés:
--    * 4 rekesz, és mind tele vagy majdnem tele van  -> a bevételezés
--      szinte minden tételt elutasítana
--    * a `project_parts` tábla ÜRES  -> Ábel „Hiányzó alkatrészek" és
--      „Lefoglalt alkatrészek" nézete üres, és a receiving.php
--      automatikus foglalásának nincs mit lefoglalnia
--
--  Az alábbi blokk Eszter sorait nem bántja, csak hozzáad.
--  A rekeszazonosítók az ő A1-1 / B1-2 konvencióját követik
--  (`bins`.`identifier` UNIQUE kulcs).
-- ---------------------------------------------------------------------

-- 3/a  További alkatrészek (a `name` UNIQUE, ezért IGNORE)
INSERT IGNORE INTO `parts` (`id`, `name`, `price`, `max_per_bin`) VALUES
  (10, 'AC kábel 10m',           12000.00, 20),
  (11, 'Rögzítő sín 2m',          9500.00, 25),
  (12, 'Teljesítményoptimalizáló', 42000.00, 12),
  (13, 'Villámvédelmi készlet',   28000.00,  8);

-- 3/b  A rekeszrács feltöltése 3 sor × 3 oszlop × 2 polc méretre.
--      Az üres rekeszek azért kellenek, hogy a bevételezést be lehessen
--      mutatni (van hová betenni az árut).
INSERT IGNORE INTO `bins`
  (`id`, `row_num`, `col_num`, `level_num`, `identifier`, `part_id`, `quantity`, `max_capacity`) VALUES
  (10, 1, 3, 1, 'A1-3',   10,  6, 20),
  (11, 1, 1, 2, 'A2-1',    1,  4, 10),
  (12, 1, 2, 2, 'A2-2', NULL,  0, 15),
  (13, 1, 3, 2, 'A2-3', NULL,  0, 20),
  (14, 2, 3, 1, 'B1-3',   11, 10, 25),
  (15, 2, 1, 2, 'B2-1', NULL,  0, 20),
  (16, 2, 2, 2, 'B2-2', NULL,  0, 15),
  (17, 2, 3, 2, 'B2-3',   12,  3, 12),
  (18, 3, 1, 1, 'C1-1',   13,  2,  8),
  (19, 3, 2, 1, 'C1-2', NULL,  0, 15),
  (20, 3, 3, 1, 'C1-3', NULL,  0, 20),
  (21, 3, 1, 2, 'C2-1', NULL,  0, 10),
  (22, 3, 2, 2, 'C2-2', NULL,  0, 15),
  (23, 3, 3, 2, 'C2-3', NULL,  0, 20);

-- 3/c  Két további projekt, hogy a bevételezés FIFO-sorrendje
--      (előbb Wait, aztán Draft, azon belül created_at szerint)
--      és a Wait -> Scheduled státuszváltás is bemutatható legyen.
--      Szándékosan nagy id-k, hogy ne ütközzenek Eszter sorával.
INSERT IGNORE INTO `projects`
  (`id`, `location`, `description`, `customer_name`, `customer_email`, `customer_phone`,
   `status`, `work_hours`, `labor_cost`, `created_at`) VALUES
  (10, 'Budaörs, Ipari park 4.', 'Csarnoktető, 24 panel', 'Nagy és Társa Kft.',
       'info@nagyestarsa.hu', '+36 23 555 100', 'Wait',      24.00, 240000.00, '2026-09-20 09:00:00'),
  (11, 'Szeged, Napfény sor 12.', 'Családi ház, 10 panel', 'Szabó Anna',
       'szabo.anna@example.hu', '+36 30 555 2200', 'Scheduled', 10.50, 105000.00, '2026-09-22 14:30:00');

INSERT INTO `project_history` (`project_id`, `status`, `changed_at`)
SELECT v.project_id, v.status, v.changed_at
FROM (
  SELECT 10 AS project_id, 'New' AS status, TIMESTAMP '2026-09-20 09:00:00' AS changed_at
  UNION ALL SELECT 10, 'Draft',     TIMESTAMP '2026-09-20 11:15:00'
  UNION ALL SELECT 10, 'Wait',      TIMESTAMP '2026-09-21 08:40:00'
  UNION ALL SELECT 11, 'New',       TIMESTAMP '2026-09-22 14:30:00'
  UNION ALL SELECT 11, 'Draft',     TIMESTAMP '2026-09-22 16:00:00'
  UNION ALL SELECT 11, 'Scheduled', TIMESTAMP '2026-09-23 10:05:00'
) AS v
WHERE NOT EXISTS (
  SELECT 1 FROM `project_history` h
  WHERE h.project_id = v.project_id AND h.status = v.status AND h.changed_at = v.changed_at
);

-- 3/d  Projekt-alkatrész igények.
--      `reserved` logikai mező, ezért a foglalás mindent-vagy-semmi:
--      egy tétel vagy teljesen le van foglalva, vagy sehogy.
INSERT IGNORE INTO `project_parts` (`project_id`, `part_id`, `quantity`, `reserved`, `reserved_at`) VALUES
  -- Eszter meglévő projektjei: még semmi nincs lefoglalva -> „Hiányzó alkatrészek"
  ( 1,  1, 12, 0, NULL),
  ( 1,  2,  1, 0, NULL),
  ( 1, 11,  8, 0, NULL),
  ( 3,  3, 20, 0, NULL),
  ( 3, 10,  4, 0, NULL),
  ( 4,  4,  5, 0, NULL),
  -- Wait projekt: ezt fogja kielégíteni a következő bevételezés (FIFO-ban ez az első)
  (10,  1,  8, 0, NULL),
  (10,  2,  2, 0, NULL),
  -- Scheduled projekt: már teljesen lefoglalva -> „Lefoglalt alkatrészek"
  (11,  3, 10, 1, '2026-09-23 10:05:00'),
  (11,  4,  4, 1, '2026-09-23 10:05:00'),
  (11, 12,  2, 1, '2026-09-23 10:05:00');


-- ---------------------------------------------------------------------
--  4. AUTO_INCREMENT értékek a kézzel adott id-k fölé
-- ---------------------------------------------------------------------
ALTER TABLE `parts`           AUTO_INCREMENT = 20;
ALTER TABLE `bins`            AUTO_INCREMENT = 30;
ALTER TABLE `projects`        AUTO_INCREMENT = 20;
ALTER TABLE `project_history` AUTO_INCREMENT = 20;
ALTER TABLE `users`           AUTO_INCREMENT = 10;


-- ---------------------------------------------------------------------
--  5. JELSZÓHASH, ADMIN, HIÁNYZÓ OSZLOPOK
--
--  Újrafuttatható: a jelszó csak akkor cserélődik, ha még a dump
--  sima szövege. A sémaelemeket csak akkor adjuk hozzá, ha hiányoznak.
-- ---------------------------------------------------------------------

UPDATE `users` SET `password` = '$2y$10$zyMXFS.fwBnpQnsHZw3YJ.bXEl9bsKmpk3rntKToCb5NS150fEndO'
  WHERE `username` = 'szakember1' AND `password` = 'A12346';
UPDATE `users` SET `password` = '$2y$10$3Ttoux/Td.daEE42qsXrluaftFBLOgEmG.KtDGVCnfw.74vH77Gyq'
  WHERE `username` = 'raktarvezeto1' AND `password` = 'Z12356';
UPDATE `users` SET `password` = '$2y$10$owpM0uKgRbSoW6kT4uFFEuLMv8wb3p8GoB1ae41PFqtVKFyFbZnX2'
  WHERE `username` = 'raktaros1' AND `password` = 'U23456';

INSERT INTO `users` (`username`, `password`, `role`)
SELECT 'admin', '$2y$10$8XFoBJQF96CX9RdRL.PZb.MhXoIJT2M4M8R0IzUxo8Jeexuu0pGC2', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `username` = 'admin');

SET @napelem_van := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_parts' AND COLUMN_NAME = 'issued_quantity'
);
SET @napelem_ddl := IF(@napelem_van = 0,
  'ALTER TABLE `project_parts` ADD COLUMN `issued_quantity` INT NOT NULL DEFAULT 0 AFTER `quantity`',
  'SELECT 1');
PREPARE napelem_ddl FROM @napelem_ddl;
EXECUTE napelem_ddl;
DEALLOCATE PREPARE napelem_ddl;

SET @napelem_van := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_history' AND COLUMN_NAME = 'user_id'
);
SET @napelem_ddl := IF(@napelem_van = 0,
  'ALTER TABLE `project_history` ADD COLUMN `user_id` INT NULL DEFAULT NULL AFTER `status`',
  'SELECT 1');
PREPARE napelem_ddl FROM @napelem_ddl;
EXECUTE napelem_ddl;
DEALLOCATE PREPARE napelem_ddl;

SET @napelem_van := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_history'
    AND CONSTRAINT_NAME = 'project_history_user_fk'
);
SET @napelem_ddl := IF(@napelem_van = 0,
  'ALTER TABLE `project_history` ADD CONSTRAINT `project_history_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL',
  'SELECT 1');
PREPARE napelem_ddl FROM @napelem_ddl;
EXECUTE napelem_ddl;
DEALLOCATE PREPARE napelem_ddl;

ALTER TABLE `project_history` MODIFY `status`
  enum('New','Draft','Wait','Scheduled','InProgress','Completed','Failed') NOT NULL;

SET @napelem_van := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND INDEX_NAME = 'projects_status_created'
);
SET @napelem_ddl := IF(@napelem_van = 0,
  'ALTER TABLE `projects` ADD INDEX `projects_status_created` (`status`, `created_at`)',
  'SELECT 1');
PREPARE napelem_ddl FROM @napelem_ddl;
EXECUTE napelem_ddl;
DEALLOCATE PREPARE napelem_ddl;

CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `part_id` int(11) NOT NULL,
  `bin_id` int(11) DEFAULT NULL,
  `project_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `movement_type` enum('receive','issue','adjust') NOT NULL,
  `quantity` int(11) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `part_id` (`part_id`),
  KEY `bin_id` (`bin_id`),
  KEY `project_id` (`project_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `stock_movements_part_fk` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `stock_movements_bin_fk` FOREIGN KEY (`bin_id`) REFERENCES `bins` (`id`) ON DELETE SET NULL,
  CONSTRAINT `stock_movements_project_fk` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL,
  CONSTRAINT `stock_movements_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `stock_movements_quantity_chk` CHECK (`quantity` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;


-- ---------------------------------------------------------------------
--  6. ELLENŐRZÉS  (az importálás végén kiírja, mi lett az eredmény)
-- ---------------------------------------------------------------------
SELECT 'users'           AS tabla, COUNT(*) AS sorok FROM `users`
UNION ALL SELECT 'parts',           COUNT(*) FROM `parts`
UNION ALL SELECT 'bins',            COUNT(*) FROM `bins`
UNION ALL SELECT 'üres rekeszek',   COUNT(*) FROM `bins` WHERE `part_id` IS NULL OR `quantity` = 0
UNION ALL SELECT 'projects',        COUNT(*) FROM `projects`
UNION ALL SELECT 'project_parts',   COUNT(*) FROM `project_parts`
UNION ALL SELECT 'project_history', COUNT(*) FROM `project_history`
UNION ALL SELECT 'stock_movements', COUNT(*) FROM `stock_movements`;

SELECT `username`, `role` FROM `users` ORDER BY `id`;
