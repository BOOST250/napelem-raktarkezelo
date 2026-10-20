// =====================================
// PROJEKTEK – ADATBÁZISBÓL
// =====================================
//
// A beégetett tesztadatok helyére az Api réteg lépett: a lista Eszter
// projects.php végpontjáról jön. A megjelenítést végző függvények
// (displayProjects, filterProjects, formatDate) nem változtak, csak az
// adat forrása.

let projects = [];


// =====================================
// STÁTUSZ NEVEK ÉS CSS OSZTÁLYOK
// =====================================
//
// A config.js-ben vannak, hogy a többi oldal is ugyanazt használja.

const statusNames = STATUSZ_NEV;
const statusClasses = STATUSZ_OSZTALY;


// =====================================
// PROJEKTEK MEGJELENÍTÉSE
// =====================================

function displayProjects(projectList) {

    const tableBody =
        document.getElementById("projectsTableBody");


    // Táblázat kiürítése

    tableBody.innerHTML = "";


    // Projekt darabszám

    document.getElementById("projectCount").textContent =
        `${projectList.length} projekt`;


    // Nincs találat

    if (projectList.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-projects">
                        Nincs a keresésnek megfelelő projekt.
                    </div>
                </td>
            </tr>
        `;

        return;
    }


    // Projektek végigjárása

    projectList.forEach(project => {

        const row = document.createElement("tr");


        row.innerHTML = `

            <td>
                #${project.id}
            </td>


            <td>

                <div class="customer-name">
                    ${project.customer_name}
                </div>

                <div class="customer-contact">
                    ${project.customer_email}
                </div>

            </td>


            <td>
                ${project.location}
            </td>


            <td>

                <span
                    class="project-status ${statusClasses[project.status]}">

                    ${statusNames[project.status]}

                </span>

            </td>


            <td>
                ${formatDate(project.created_at)}
            </td>


            <td>

                <a
                    href="project.html?id=${project.id}"
                    class="open-project">

                    Megnyitás

                </a>

            </td>

        `;


        tableBody.appendChild(row);

    });

}


// =====================================
// DÁTUM FORMÁZÁSA
// =====================================

function formatDate(dateString) {

    const date = new Date(dateString);


    return date.toLocaleDateString(
        "hu-HU",
        {
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    );

}


// =====================================
// KERESÉS ÉS SZŰRÉS
// =====================================

function filterProjects() {

    const searchInput =
        document.getElementById("searchInput");


    const statusFilter =
        document.getElementById("statusFilter");


    const searchText =
        searchInput.value.toLowerCase().trim();


    const selectedStatus =
        statusFilter.value;


    const filteredProjects =
        projects.filter(project => {


            // Keresés ügyfél vagy helyszín alapján

            const matchesSearch =

                project.customer_name
                    .toLowerCase()
                    .includes(searchText)

                ||

                project.location
                    .toLowerCase()
                    .includes(searchText);


            // Státusz szűrés

            const matchesStatus =

                selectedStatus === "all"

                ||

                project.status === selectedStatus;


            return matchesSearch && matchesStatus;

        });


    displayProjects(filteredProjects);

}


// =====================================
// BETÖLTÉS AZ ADATBÁZISBÓL
// =====================================

// Hibajelzés a táblázat helyén (a .empty-projects stílust használja).
function showLoadError(message) {

    document.getElementById("projectCount").textContent = "–";

    document.getElementById("projectsTableBody").innerHTML = `
        <tr>
            <td colspan="6">
                <div class="empty-projects">
                    ${message}
                </div>
            </td>
        </tr>
    `;
}


async function loadProjects() {

    document.getElementById("projectsTableBody").innerHTML = `
        <tr>
            <td colspan="6">
                <div class="empty-projects">
                    Projektek betöltése…
                </div>
            </td>
        </tr>
    `;

    try {

        projects = await Api.projektek();

        filterProjects();

    } catch (error) {

        showLoadError(error.message);

    }
}


// =====================================
// OLDAL BETÖLTÉSE
// =====================================

document.addEventListener(
    "DOMContentLoaded",
    function () {


        // Projektek betöltése és megjelenítése

        loadProjects();


        // Keresés

        document
            .getElementById("searchInput")
            .addEventListener(
                "input",
                filterProjects
            );


        // Státusz szűrés

        document
            .getElementById("statusFilter")
            .addEventListener(
                "change",
                filterProjects
            );

    }
);
