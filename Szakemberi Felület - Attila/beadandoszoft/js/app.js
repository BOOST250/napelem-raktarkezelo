// =====================================
// KÖZÖS FEJLÉC ÉS KIJELENTKEZÉS
// =====================================
//
// Minden oldal betölti. Két dolgot végez:
//
//   1. Beléptetés-ellenőrzés: Api.me() megkérdezi a backendtől, ki van
//      bejelentkezve. Ha nincs session, vagy nem szakember a szerepkör,
//      vissza a login.html-re.
//
//   2. A jobb felső sarok kitöltése a valódi felhasználó adataival, és
//      a Kijelentkezés gomb bekötése a logout.php végpontra.
//
// Korábban itt egy beégetett currentUser objektum volt, a kijelentkezés
// pedig csak átnavigált a login.html-re. Emiatt a PHP session életben
// maradt (a visszalépés újra beengedett), és a login.html akkor még nem
// is létezett – vagyis a gomb 404-re vitt.

document.addEventListener("DOMContentLoaded", async function () {

    // A KÖZÖS belépő oldal a napelem mappában van, a felületek mellett:
    //     .../napelem/belepes/      ← közös belépő (mindhárom felülethez)
    //     .../napelem/szakember/    ← ez a felület
    // Onnan a users tábla bármelyik fiókjával be lehet lépni, és a
    // szerepkör alapján irányít a megfelelő felületre.
    // Az aloldalak a pages/ alatt futnak, ezért kell egy szinttel több "..".
    const belepoUt = Api.belepesUt();


    // =========================
    // 1. BEJELENTKEZÉS ELLENŐRZÉSE
    // =========================

    let currentUser;

    try {
        currentUser = await Api.me();
    } catch (err) {
        // 401 (nincs session) vagy a szerver nem érhető el
        location.replace(belepoUt);
        return;
    }

    if (!currentUser || currentUser.role !== CONFIG.ENGEDETT_SZEREPKOR) {
        // Érvényes session, de nem szakember: ne hagyjuk félkész
        // állapotban, léptessük ki.
        await Api.logout().catch(function () {});
        location.replace(belepoUt);
        return;
    }

    // Innentől biztos, hogy jogosult a felhasználó – megjelenhet az oldal.
    document.dispatchEvent(new CustomEvent("szakember-kesz", { detail: currentUser }));
    if (CONFIG.USE_MOCK) demoSav();
    document.body.classList.remove("auth-pending");


    // =========================
    // 2. FELHASZNÁLÓ ADATAI
    // =========================

    // Felhasználónév megjelenítése
    const usernameElement = document.getElementById("username");

    if (usernameElement) {
        usernameElement.textContent = currentUser.username;
    }


    // Szerepkör megjelenítése (a nevek a config.js-ben vannak)
    const roleElement = document.getElementById("userRole");

    if (roleElement) {
        roleElement.textContent =
            SZEREPKOR_NEV[currentUser.role] || currentUser.role;
    }


    // Monogram a kis kör alakú ikonban
    const avatarElement = document.querySelector(".user-avatar");

    if (avatarElement && currentUser.username) {
        avatarElement.textContent = currentUser.username.slice(0, 2).toUpperCase();
    }


    // =========================
    // 3. KIJELENTKEZÉS
    // =========================

    const logoutButton = document.getElementById("logoutButton");

    if (logoutButton) {

        logoutButton.addEventListener("click", async function () {

            // FIGYELEM: itt szándékosan NEM a beépített confirm()-ot
            // használjuk. A beágyazott böngészőkben (pl. a Claude
            // előnézeti panelje) a natív párbeszédablakot a böngésző
            // azonnal elutasítja, a confirm() false-t ad vissza, és így
            // a kijelentkezés látszólag "nem csinál semmit". A saját
            // ablakunk minden böngészőben egyformán működik.
            const rendben = await megerosit(
                "Kijelentkezés",
                "Biztosan ki szeretnél jelentkezni?",
                "Kijelentkezés"
            );

            if (!rendben) {
                return;
            }

            // A valódi kiléptetés a szerveren történik: a logout.php
            // kiüríti és eldobja a PHP session-t, és törli a cookie-t.
            // Csak ha ez sikerült, navigálunk el.
            try {
                await Api.logout();
            } catch (err) {
                await megerosit(
                    "Nem sikerült kijelentkezni",
                    err.message,
                    null
                );
                return;
            }

            // A hash-ből tudja a login.html, hogy visszajelzést mutasson.
            location.replace(belepoUt + "#kijelentkezve");
        });

    }

});


// =====================================
// SAJÁT MEGERŐSÍTŐ ABLAK
// =====================================
// A confirm() / alert() helyett. Promise-t ad vissza: true, ha a
// felhasználó jóváhagyta. Ha az okGomb null, csak egy "Rendben" gomb
// jelenik meg (hibaüzenethez).

function demoSav() {
    const tartalom = document.querySelector(".main-content");
    if (!tartalom || document.getElementById("demoSav")) return;

    const sav = document.createElement("div");
    sav.id = "demoSav";
    sav.className = "demo-sav";

    const szoveg = document.createElement("span");
    szoveg.textContent = "Demo mód: a módosítások csak ebben a böngészőben tárolódnak.";

    const vissza = document.createElement("button");
    vissza.type = "button";
    vissza.className = "demo-sav-gomb";
    vissza.textContent = "Demo adatok visszaállítása";
    vissza.addEventListener("click", async function () {
        const rendben = await megerosit(
            "Demo adatok",
            "Visszaállítod a beépített tesztadatokat? A bejelentkezés megmarad.",
            "Visszaállítás"
        );
        if (!rendben) return;
        MockBackend.visszaallit();
        location.reload();
    });

    const eles = document.createElement("a");
    eles.className = "demo-sav-gomb";
    eles.href = location.pathname + "?mock=0";
    eles.textContent = "Éles mód";

    sav.appendChild(szoveg);
    sav.appendChild(vissza);
    sav.appendChild(eles);
    tartalom.prepend(sav);
}


function megerosit(cim, szoveg, okGomb) {

    return new Promise(function (resolve) {

        const hatter = document.createElement("div");
        hatter.className = "modal-hatter";

        const doboz = document.createElement("div");
        doboz.className = "modal-doboz";
        doboz.setAttribute("role", "dialog");
        doboz.setAttribute("aria-modal", "true");

        const cimElem = document.createElement("h2");
        cimElem.className = "modal-cim";
        cimElem.textContent = cim;

        const szovegElem = document.createElement("p");
        szovegElem.className = "modal-szoveg";
        szovegElem.textContent = szoveg;

        const gombsor = document.createElement("div");
        gombsor.className = "modal-gombsor";

        function bezar(ertek) {
            document.removeEventListener("keydown", billentyu);
            hatter.remove();
            resolve(ertek);
        }

        function billentyu(event) {
            if (event.key === "Escape") { bezar(false); }
        }

        if (okGomb) {
            const megseGomb = document.createElement("button");
            megseGomb.type = "button";
            megseGomb.className = "modal-gomb modal-gomb-megse";
            megseGomb.textContent = "Mégse";
            megseGomb.addEventListener("click", function () { bezar(false); });
            gombsor.appendChild(megseGomb);
        }

        const igenGomb = document.createElement("button");
        igenGomb.type = "button";
        igenGomb.className = "modal-gomb modal-gomb-fo";
        igenGomb.textContent = okGomb || "Rendben";
        igenGomb.addEventListener("click", function () { bezar(true); });
        gombsor.appendChild(igenGomb);

        doboz.appendChild(cimElem);
        doboz.appendChild(szovegElem);
        doboz.appendChild(gombsor);
        hatter.appendChild(doboz);

        // A háttérre kattintás is mégse.
        hatter.addEventListener("click", function (event) {
            if (event.target === hatter) { bezar(false); }
        });

        document.addEventListener("keydown", billentyu);
        document.body.appendChild(hatter);
        igenGomb.focus();
    });
}
