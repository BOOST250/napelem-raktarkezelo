/* ================= Projekt részletező oldal =================
   Ez az oldal a szakember fő munkaterülete, és egyben ez a kapcsolat a
   raktárvezetői felülettel:

     szakember felvesz egy alkatrészigényt  →  project_parts tábla
                                            →  a raktárvezető felületén
                                               megjelenik a "Hiányzó
                                               alkatrészek" listában
                                            →  bevételezéskor a raktár
                                               lefoglalja (reserved=1)
                                            →  itt látszik, hogy a tétel
                                               már foglalt, és a projekt
                                               Scheduled állapotba kerül

   Ezért a lefoglalt (reserved=1) sorokat nem engedjük szerkeszteni: a
   raktár már elkötelezte rájuk a készletet, az utólagos módosítás
   szétcsúsztatná a foglalást. */

// Az azonosító a listaoldal linkjéből jön: project.html?id=3
const projektId = Number(new URLSearchParams(window.location.search).get("id"));

// Az oldal adatai – minden újrarajzolás ezekből dolgozik
let projekt = null;      // egy projects sor
let tetelek = [];        // a projekt project_parts sorai
let alkatreszek = [];    // a teljes alkatrészlista készletadatokkal


/* =====================================
   ÁLLAPOTLÉPÉSEK

   Csak azokat a lépéseket engedjük, amik a szakemberre tartoznak.
   A Wait → Scheduled váltás szándékosan NINCS itt: azt a raktár
   bevételezése végzi, amikor az összes igényt le tudta foglalni.
===================================== */

const LEPESEK = {
    New: [
        { cel: "Draft", felirat: "Alkatrészigény összeállítása", elsodleges: true }
    ],
    Draft: [
        { cel: "Wait", felirat: "Igénylés leadása a raktárnak", elsodleges: true, igenyKell: true }
    ],
    Wait: [],
    Scheduled: [
        { cel: "InProgress", felirat: "Kivitelezés megkezdése", elsodleges: true }
    ],
    InProgress: [
        { cel: "Completed", felirat: "Projekt befejezése", elsodleges: true },
        { cel: "Failed", felirat: "Projekt meghiúsult" }
    ],
    Completed: [],
    Failed: []
};

const ALLAPOT_SUGO = {
    New: "Új projekt. Vedd fel az alkatrészigényt, majd lépj tovább tervezetre.",
    Draft: "Tervezet: az alkatrészigény még szerkeszthető. Ha kész, add le a raktárnak.",
    Wait: "A raktár visszajelzésére várunk. Amikor minden alkatrész megvan, a bevételezés lefoglalja őket, és a projekt ütemezett lesz.",
    Scheduled: "A raktár lefoglalta az alkatrészeket, a kivitelezés indulhat.",
    InProgress: "Kivitelezés folyamatban. A végén rögzítsd a munkaórát és a munkadíjat.",
    Completed: "A projekt befejeződött, már nem módosítható.",
    Failed: "A projekt meghiúsult, már nem módosítható."
};

// Ezekben az állapotokban szerkeszthető még az alkatrészigény
const SZERKESZTHETO_ALLAPOTOK = ["New", "Draft", "Wait"];


/* =====================================
   SEGÉDFÜGGVÉNYEK
===================================== */

// A felhasználói adatok (ügyfél neve stb.) HTML-be kerülnek, ezért
// escape-elni kell őket
function esc(szoveg) {
    return String(szoveg ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatFt(szam) {
    if (szam === null || szam === undefined) return "–";
    return Number(szam).toLocaleString("hu-HU") + " Ft";
}

// A MySQL "2026-03-14 09:12:00" formátumban ad vissza dátumot
function formatDatum(ertek) {
    if (!ertek) return "–";
    const datum = new Date(String(ertek).replace(" ", "T"));
    if (isNaN(datum)) return String(ertek);
    return datum.toLocaleString("hu-HU", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

// Az üzenetsávok mind .form-message osztályúak, ezért display: none a
// kezdőállapotuk – a megjelenítéshez be kell állítani
function uzenet(elemId, szoveg, hiba) {
    const elem = document.getElementById(elemId);
    if (!szoveg) {
        elem.style.display = "none";
        return;
    }
    elem.textContent = szoveg;
    elem.className = "form-message " + (hiba ? "error-message" : "success-message");
    elem.style.display = "block";
}


/* =====================================
   MEGJELENÍTÉS
===================================== */

function renderProjekt() {
    document.getElementById("projectTitle").textContent = projekt.location || "Névtelen projekt";
    document.getElementById("projectSubtitle").textContent =
        projekt.customer_name ? "Ügyfél: " + projekt.customer_name : "–";

    const statuszElem = document.getElementById("projectStatus");
    statuszElem.textContent = STATUSZ_NEV[projekt.status] || projekt.status;
    statuszElem.className = "project-status " + (STATUSZ_OSZTALY[projekt.status] || "");

    document.getElementById("detailCustomer").textContent = projekt.customer_name || "–";
    document.getElementById("detailEmail").textContent = projekt.customer_email || "–";
    document.getElementById("detailPhone").textContent = projekt.customer_phone || "–";
    document.getElementById("detailLocation").textContent = projekt.location || "–";
    document.getElementById("detailCreated").textContent = formatDatum(projekt.created_at);
    document.getElementById("detailDescription").textContent = projekt.description || "–";

    // A null értéket üresen hagyjuk, nem 0-ként mutatjuk
    document.getElementById("workHours").value = projekt.work_hours ?? "";
    document.getElementById("laborCost").value = projekt.labor_cost ?? "";
}


// Szerkeszthető-e még egyáltalán az alkatrészigény ebben az állapotban
function szerkesztheto() {
    return SZERKESZTHETO_ALLAPOTOK.includes(projekt.status);
}


function renderTetelek() {
    const tbody = document.getElementById("partsTableBody");

    if (tetelek.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="6"><div class="empty-projects">' +
            "Még nincs felvett alkatrészigény ehhez a projekthez." +
            "</div></td></tr>";
        document.getElementById("partsSummary").textContent = "0 tétel";
        return;
    }

    tbody.innerHTML = tetelek.map(function (tetel) {
        const alkatresz = alkatreszek.find(a => a.id === tetel.part_id);
        const ertek = tetel.part_price * tetel.quantity;

        // A lefoglalt sort a raktár már "kifizette" készletben, ezért zárolt
        const zarolt = tetel.reserved || !szerkesztheto();

        const mennyisegCella = zarolt
            ? esc(tetel.quantity) + " db"
            : '<input type="number" class="qty-input" min="1" step="1" ' +
              'value="' + esc(tetel.quantity) + '" ' +
              'data-part="' + esc(tetel.part_id) + '">';

        let raktarCella;
        if (tetel.reserved) {
            raktarCella = '<span class="project-status status-scheduled">Lefoglalva</span>';
        } else if (!alkatresz) {
            raktarCella = "–";
        } else if (alkatresz.szabad >= tetel.quantity) {
            raktarCella = esc(alkatresz.szabad) + " db szabad";
        } else {
            raktarCella =
                '<span class="project-status status-failed">' +
                "hiányzik " + esc(tetel.quantity - alkatresz.szabad) + " db" +
                "</span>";
        }

        const muveletCella = zarolt
            ? "–"
            : '<button type="button" class="secondary-button" ' +
              'data-torol="' + esc(tetel.part_id) + '">Törlés</button>';

        return "<tr>" +
            "<td><strong>" + esc(tetel.part_name) + "</strong></td>" +
            "<td>" + formatFt(tetel.part_price) + "</td>" +
            "<td>" + mennyisegCella + "</td>" +
            "<td>" + formatFt(ertek) + "</td>" +
            "<td>" + raktarCella + "</td>" +
            "<td>" + muveletCella + "</td>" +
            "</tr>";
    }).join("");

    const osszErtek = tetelek.reduce((s, t) => s + t.part_price * t.quantity, 0);
    const foglalt = tetelek.filter(t => t.reserved).length;

    document.getElementById("partsSummary").textContent =
        tetelek.length + " tétel, " + formatFt(osszErtek) + " anyagérték" +
        (foglalt > 0 ? " – ebből " + foglalt + " tétel lefoglalva" : "");
}


function renderAlkatreszValaszto() {
    const valaszto = document.getElementById("partSelect");
    const szakasz = document.getElementById("addPartSection");

    // Lezárt projekthez már nem lehet igényt felvenni
    szakasz.style.display = szerkesztheto() ? "" : "none";
    if (!szerkesztheto()) return;

    // A már felvett alkatrészeket kihagyjuk: a (project_id, part_id) összetett
    // elsődleges kulcs miatt ugyanaz az alkatrész nem szerepelhet kétszer –
    // a mennyiséget a táblázatban kell módosítani
    const felvettek = new Set(tetelek.map(t => t.part_id));
    const valaszthatok = alkatreszek.filter(a => !felvettek.has(a.id));

    if (valaszthatok.length === 0) {
        valaszto.innerHTML = '<option value="">Minden alkatrész szerepel már a listán</option>';
        valaszto.disabled = true;
        document.getElementById("addPartButton").disabled = true;
        return;
    }

    valaszto.disabled = false;
    document.getElementById("addPartButton").disabled = false;
    valaszto.innerHTML =
        '<option value="">Válassz alkatrészt…</option>' +
        valaszthatok.map(a =>
            '<option value="' + esc(a.id) + '">' +
            esc(a.name) + " – " + formatFt(a.price) +
            " (" + a.szabad + " db szabad)" +
            "</option>"
        ).join("");
}


function renderStatusz() {
    document.getElementById("statusHint").textContent = ALLAPOT_SUGO[projekt.status] || "";

    const hely = document.getElementById("statusActions");
    const lepesek = LEPESEK[projekt.status] || [];

    if (lepesek.length === 0) {
        hely.innerHTML =
            '<span class="input-hint">Ebben az állapotban a szakembernek nincs tennivalója.</span>';
    } else {
        hely.innerHTML = lepesek.map(function (lepes) {
            // Üres igénylistával nincs értelme leadni a rendelést a raktárnak
            const tiltva = lepes.igenyKell && tetelek.length === 0;
            return '<button type="button" ' +
                'class="' + (lepes.elsodleges ? "primary-button" : "secondary-button") + '" ' +
                'data-statusz="' + esc(lepes.cel) + '"' +
                (tiltva ? ' disabled title="Előbb vegyél fel legalább egy alkatrészt."' : "") +
                ">" + esc(lepes.felirat) + "</button>";
        }).join("");
    }

    // A munkaadatokat csak folyamatban lévő projektnél engedjük rögzíteni
    const munkaMehet = projekt.status === "InProgress";
    document.getElementById("workHours").disabled = !munkaMehet;
    document.getElementById("laborCost").disabled = !munkaMehet;
    document.getElementById("saveWorkButton").disabled = !munkaMehet;
}


function renderTortenet(tortenet) {
    const tbody = document.getElementById("historyTableBody");

    if (!tortenet || tortenet.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="2"><div class="empty-projects">' +
            "Nincs előzmény." +
            "</div></td></tr>";
        return;
    }

    tbody.innerHTML = tortenet.map(sor =>
        "<tr>" +
        '<td><span class="project-status ' + (STATUSZ_OSZTALY[sor.status] || "") + '">' +
        esc(STATUSZ_NEV[sor.status] || sor.status) + "</span></td>" +
        "<td>" + formatDatum(sor.changed_at) + "</td>" +
        "</tr>"
    ).join("");
}


/* =====================================
   BETÖLTÉS

   Négy lekérés fut párhuzamosan. A projects.php kétszer is bejön (egyszer
   a projekt adataiért, egyszer a készletszámításhoz), mert a backend nem
   tud egy rekordot külön visszaadni – ez tudatos egyszerűsítés.
===================================== */

async function ujratolt() {
    const [p, t, a, h] = await Promise.all([
        Api.projekt(projektId),
        Api.projektAlkatreszek(projektId),
        Api.alkatreszek(),
        Api.projektTortenet(projektId)
    ]);

    projekt = p;
    tetelek = t;
    alkatreszek = a;

    renderProjekt();
    renderTetelek();
    renderAlkatreszValaszto();
    renderStatusz();
    renderTortenet(h);
}


async function betolt() {
    if (!projektId) {
        uzenet("pageMessage",
            "Hiányzik a projekt azonosítója. Nyisd meg a projektet a listából.", true);
        return;
    }

    const sav = document.getElementById("pageMessage");
    sav.className = "form-message";
    sav.textContent = "Projekt betöltése…";
    sav.style.display = "block";

    try {
        await ujratolt();
        sav.style.display = "none";
        document.getElementById("pageContent").style.display = "";
    } catch (hiba) {
        uzenet("pageMessage", hiba.message, true);
    }
}


/* =====================================
   ALKATRÉSZIGÉNY KEZELÉSE
===================================== */

async function alkatreszHozzaadas() {
    const valaszto = document.getElementById("partSelect");
    const darabElem = document.getElementById("partQuantity");

    const alkatreszId = Number(valaszto.value);
    const darab = Number(darabElem.value);

    if (!alkatreszId) {
        uzenet("partsMessage", "Válassz alkatrészt a listából.", true);
        return;
    }
    if (!Number.isInteger(darab) || darab < 1) {
        uzenet("partsMessage", "A mennyiség legalább 1 db legyen.", true);
        return;
    }

    const gomb = document.getElementById("addPartButton");
    gomb.disabled = true;
    uzenet("partsMessage", "", false);

    try {
        await Api.ujProjektAlkatresz(projektId, alkatreszId, darab);

        // Az első igény felvételével a projekt tervezetté válik: innentől
        // van mit leadni a raktárnak
        if (projekt.status === "New") {
            await Api.projektStatusz(projektId, "Draft");
        }

        darabElem.value = 1;
        // Az ujratolt() állítja be a gomb és a választó helyes állapotát
        await ujratolt();

        uzenet("partsMessage",
            "Az alkatrészigény rögzítve. Ha a lista kész, add le a raktárnak " +
            "az alábbi Állapot szakaszban.", false);
    } catch (hiba) {
        uzenet("partsMessage", hiba.message, true);
        gomb.disabled = false;
    }
}


async function darabMentes(alkatreszId, input) {
    const darab = Number(input.value);

    if (!Number.isInteger(darab) || darab < 1) {
        uzenet("partsMessage", "A mennyiség legalább 1 db legyen.", true);
        renderTetelek();   // visszaállítja a korábbi értéket
        return;
    }

    input.disabled = true;
    try {
        await Api.modositProjektAlkatresz(projektId, alkatreszId, { quantity: darab });
        await ujratolt();
        uzenet("partsMessage", "A mennyiség módosítva.", false);
    } catch (hiba) {
        uzenet("partsMessage", hiba.message, true);
        renderTetelek();
    }
}


async function tetelTorles(alkatreszId) {
    const tetel = tetelek.find(t => t.part_id === alkatreszId);
    const nev = tetel ? tetel.part_name : "alkatrész";

    // A megerosit() az app.js-ben van; a beépített confirm() helyett kell,
    // mert azt a beágyazott böngészők azonnal elutasítják.
    const rendben = await megerosit(
        "Tétel törlése",
        "Biztosan törlöd a listáról: " + nev + "?",
        "Törlés"
    );
    if (!rendben) return;

    try {
        await Api.torolProjektAlkatresz(projektId, alkatreszId);
        await ujratolt();
        uzenet("partsMessage", "A tétel törölve a listáról.", false);
    } catch (hiba) {
        uzenet("partsMessage", hiba.message, true);
    }
}


/* =====================================
   ÁLLAPOT ÉS MUNKAADATOK
===================================== */

async function statuszValtas(cel) {
    uzenet("statusMessage", "", false);

    try {
        // A projects.php PUT-ja magától beír egy sort a project_history
        // táblába, ezért azt itt nem kell külön rögzíteni
        await Api.projektStatusz(projektId, cel);
        await ujratolt();

        let szoveg = "Az állapot módosítva: " + (STATUSZ_NEV[cel] || cel) + ".";
        if (cel === "Wait") {
            szoveg += " Az igénylés innentől megjelenik a raktárvezető " +
                      "felületén a hiányzó alkatrészek között.";
        }
        uzenet("statusMessage", szoveg, false);
    } catch (hiba) {
        uzenet("statusMessage", hiba.message, true);
    }
}


async function munkaMentes() {
    const ora = document.getElementById("workHours").value.trim();
    const dij = document.getElementById("laborCost").value.trim();

    if (ora === "" && dij === "") {
        uzenet("statusMessage", "Adj meg munkaórát vagy munkadíjat.", true);
        return;
    }

    // Csak a kitöltött mezőket küldjük: a projects.php isset()-tel vizsgál,
    // ezért a null értéket amúgy sem venné figyelembe
    const adat = {};
    if (ora !== "") adat.work_hours = Number(ora);
    if (dij !== "") adat.labor_cost = Number(dij);

    if (Object.values(adat).some(v => !Number.isFinite(v) || v < 0)) {
        uzenet("statusMessage", "A munkaóra és a munkadíj csak nem negatív szám lehet.", true);
        return;
    }

    const gomb = document.getElementById("saveWorkButton");
    gomb.disabled = true;
    try {
        await Api.modositProjekt(projektId, adat);
        await ujratolt();
        uzenet("statusMessage", "A munkaadatok mentve.", false);
    } catch (hiba) {
        uzenet("statusMessage", hiba.message, true);
    } finally {
        gomb.disabled = false;
    }
}


/* =====================================
   OLDAL BETÖLTÉSE

   A táblázat sorai minden mentés után újraépülnek, ezért nem közvetlenül
   a sorokra, hanem a tbody-ra tesszük a figyelőket.
===================================== */

document.addEventListener("DOMContentLoaded", function () {
    betolt();

    document.getElementById("addPartButton")
        .addEventListener("click", alkatreszHozzaadas);

    document.getElementById("partQuantity")
        .addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                alkatreszHozzaadas();
            }
        });

    document.getElementById("saveWorkButton")
        .addEventListener("click", munkaMentes);

    const tbody = document.getElementById("partsTableBody");

    tbody.addEventListener("change", function (e) {
        if (e.target.classList.contains("qty-input")) {
            darabMentes(Number(e.target.dataset.part), e.target);
        }
    });

    tbody.addEventListener("click", function (e) {
        const gomb = e.target.closest("[data-torol]");
        if (gomb) tetelTorles(Number(gomb.dataset.torol));
    });

    document.getElementById("statusActions")
        .addEventListener("click", function (e) {
            const gomb = e.target.closest("[data-statusz]");
            if (gomb && !gomb.disabled) statuszValtas(gomb.dataset.statusz);
        });
});
