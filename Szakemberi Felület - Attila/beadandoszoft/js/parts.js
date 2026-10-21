// =====================================
// ALKATRÉSZEK – ADATBÁZISBÓL
// =====================================
//
// Az Api.alkatreszek() a parts, bins, project_parts és projects
// végpontokból számolja ki alkatrészenként a raktárkészletet, a
// lefoglalt és a szabad mennyiséget, valamint a még nem lefoglalt igényt.

let parts = [];


// A nevek HTML-be kerülnek, ezért escape-elni kell őket
function esc(szoveg) {
    return String(szoveg ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatFt(szam) {
    return Number(szam).toLocaleString("hu-HU") + " Ft";
}

function formatDb(szam) {
    return Number(szam).toLocaleString("hu-HU") + " db";
}


// =====================================
// ALKATRÉSZEK MEGJELENÍTÉSE
// =====================================

function showMessage(message) {
    document.getElementById("partsTableBody").innerHTML = `
        <tr>
            <td colspan="6">
                <div class="empty-projects">
                    ${esc(message)}
                </div>
            </td>
        </tr>
    `;
}

function displayParts(partList) {

    document.getElementById("partCount").textContent =
        `${partList.length} alkatrész`;

    if (partList.length === 0) {
        showMessage(parts.length === 0
            ? "Még nincs alkatrész a raktárban."
            : "Nincs a keresésnek megfelelő alkatrész.");
        return;
    }

    const tableBody = document.getElementById("partsTableBody");
    tableBody.innerHTML = "";

    partList.forEach(part => {

        const row = document.createElement("tr");

        // Szabad készlet jelölése: zöld, ha van; sárga, ha elfogyott
        const szabadOsztaly = part.szabad > 0
            ? "status-completed"
            : (part.szabad < 0 ? "status-failed" : "status-wait");

        row.innerHTML = `
            <td>
                <div class="customer-name">
                    ${esc(part.name)}
                </div>
                <div class="customer-contact">
                    max. ${esc(part.max_per_bin)} db / rekesz
                </div>
            </td>

            <td>
                ${formatFt(part.price)}
            </td>

            <td>
                ${formatDb(part.keszlet)}
            </td>

            <td>
                ${formatDb(part.lefoglalt)}
            </td>

            <td>
                <span class="project-status ${szabadOsztaly}">
                    ${formatDb(part.szabad)}
                </span>
            </td>

            <td>
                ${part.igenyelt > 0 ? formatDb(part.igenyelt) : "–"}
            </td>
        `;

        tableBody.appendChild(row);
    });
}


// =====================================
// KERESÉS ÉS SZŰRÉS
// =====================================

function filterParts() {

    const searchText =
        document.getElementById("searchInput").value.trim().toLowerCase();

    const stock =
        document.getElementById("stockFilter").value;

    const filtered = parts.filter(part => {

        const matchesSearch = part.name.toLowerCase().includes(searchText);

        const matchesStock =
            stock === "all" ||
            (stock === "available" && part.szabad > 0) ||
            (stock === "none" && part.szabad <= 0);

        return matchesSearch && matchesStock;
    });

    displayParts(filtered);
}


// =====================================
// BETÖLTÉS AZ ADATBÁZISBÓL
// =====================================

async function loadParts() {

    showMessage("Alkatrészek betöltése…");

    try {
        parts = (await Api.alkatreszek())
            .sort((a, b) => a.name.localeCompare(b.name, "hu"));
        filterParts();
    } catch (error) {
        document.getElementById("partCount").textContent = "–";
        showMessage(error.message);
    }
}


// =====================================
// OLDAL BETÖLTÉSE
// =====================================

document.addEventListener("DOMContentLoaded", function () {

    loadParts();

    document.getElementById("searchInput").addEventListener("input", filterParts);

    document.getElementById("stockFilter").addEventListener("change", filterParts);
});
