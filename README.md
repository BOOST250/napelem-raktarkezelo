# SolarSystem – napelemes raktárkezelő rendszer

Csapatprojekt (Szoftvertechnológia beadandó): napelemrendszer-telepítő cég raktár- és projektkezelő webalkalmazása.
PHP + MySQL backend, sima HTML/CSS/JavaScript felületek, keretrendszer nélkül.

## Felépítés

| Mappa | Tartalom | Készítette |
|---|---|---|
| `Adatbazis + backend - Eszter/napelem/` | PHP API (`api/`), bejelentkezés (`auth/`), adatbázis-kapcsolat, SQL-fájlok | Eszter |
| `Közös/belepes/` | Közös belépő oldal – szerepkör alapján a megfelelő felületre visz | közös |
| `Szakemberi Felület - Attila/beadandoszoft/` | Szakemberi felület (projektek) | Attila |
| `Raktárvezetői felület - Én/raktarvezeto/` | Raktárvezetői felület (alkatrészek, rekeszek, bevételezés) | Ábel |
| `Raktárosi Felület -Ivett/` | Raktárosi felület (fejlesztés alatt) | Ivett |

## Futtatás (XAMPP)

1. Indítsd el az Apache-t és a MySQL-t a XAMPP-ban.
2. phpMyAdminban importáld a `napelemrendszer.sql`-t, utána a `napelemrendszer_illesztes.sql`-t.
3. Másold a `napelem` mappát a `C:\xampp\htdocs\` alá, és mellé (a `napelem` mappán belülre) a felületeket ezekkel a nevekkel:
   ```
   htdocs/napelem/
   ├── api/  auth/  config/        (backend)
   ├── belepes/                    ← Közös/belepes
   ├── szakember/                  ← Szakemberi Felület - Attila/beadandoszoft
   ├── raktarvezeto/               ← Raktárvezetői felület - Én/raktarvezeto
   └── raktaros/                   ← Raktárosi Felület -Ivett
   ```
4. Nyisd meg: `http://<szerver>/napelem/belepes/` – a `<szerver>` a gép saját címe (`localhost` vagy a LAN-IP). A felületek host nélküli útvonalat használnak (`/napelem/api`), ezért másik gépről is ugyanez a lap nyílik.

A felhasználókat az adminisztrátor veszi fel (`users` tábla); regisztráció nincs. A jelszavakat a backend hash-elve tárolja.

A raktárvezetői felület backend nélkül, demo módban is kipróbálható – lásd [a felület README-jét](<Raktárvezetői felület - Én/raktarvezeto/README.md>).

A szakemberi felület leírása és a demo mód (`?mock=1`): [Szakemberi felület README](<Szakemberi Felület - Attila/beadandoszoft/README.md>).
