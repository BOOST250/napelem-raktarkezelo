// =====================================
// ÚJ PROJEKT
// =====================================

document.addEventListener(
    "DOMContentLoaded",
    function () {


        const form =
            document.getElementById("newProjectForm");


        const errorMessage =
            document.getElementById("formError");


        const successMessage =
            document.getElementById("formSuccess");


        const submitButton =
            document.getElementById("submitButton");


        // =================================
        // ŰRLAP ELKÜLDÉSE
        // =================================

        form.addEventListener(
            "submit",
            async function (event) {

                // Megakadályozzuk az oldal
                // újratöltését

                event.preventDefault();


                // Régi üzenetek törlése

                errorMessage.style.display = "none";

                successMessage.style.display = "none";


                // =================================
                // ADATOK BEOLVASÁSA
                // =================================

                const location =
                    document
                        .getElementById("location")
                        .value
                        .trim();


                const description =
                    document
                        .getElementById("description")
                        .value
                        .trim();


                const customerName =
                    document
                        .getElementById("customerName")
                        .value
                        .trim();


                const customerEmail =
                    document
                        .getElementById("customerEmail")
                        .value
                        .trim();


                const customerPhone =
                    document
                        .getElementById("customerPhone")
                        .value
                        .trim();


                // =================================
                // ELLENŐRZÉS
                // =================================

                const ellenorzes = projektAdatHiba({
                    location: location,
                    description: description,
                    customer_name: customerName,
                    customer_email: customerEmail,
                    customer_phone: customerPhone
                });

                if (ellenorzes) {

                    showError(ellenorzes);

                    return;
                }


                // =================================
                // MENTÉS AZ ADATBÁZISBA
                // =================================
                //
                // Az azonosítót és a létrehozás idejét az adatbázis adja
                // (AUTO_INCREMENT, illetve created_at), a státusz pedig a
                // projects.php-ben fixen 'New' – ezeket nem küldjük.
                // A projects.php a project_history táblába is beír egy sort.

                submitButton.disabled = true;

                const eredetiFelirat = submitButton.textContent;

                submitButton.textContent = "Mentés…";

                let newProjectId;

                try {

                    newProjectId = await Api.ujProjekt({
                        location: location,
                        description: description,
                        customer_name: customerName,
                        customer_email: customerEmail || null,
                        customer_phone: customerPhone || null
                    });

                } catch (error) {

                    showError(error.message);

                    return;

                } finally {

                    submitButton.disabled = false;

                    submitButton.textContent = eredetiFelirat;

                }


                // =================================
                // SIKERES ÜZENET
                // =================================

                successMessage.textContent =
                    "A projekt sikeresen létrejött! Következő lépés: az alkatrészigény rögzítése.";


                successMessage.style.display =
                    "block";


                // Űrlap törlése

                form.reset();


                // =================================
                // 1,5 MÁSODPERC UTÁN TOVÁBB
                // A PROJEKT RÉSZLETEIRE
                // =================================
                //
                // Egyből a részletező oldalra megyünk, mert ott kell
                // felvenni az alkatrészigényt – az látszik majd a
                // raktárvezetői felületen.

                setTimeout(
                    function () {

                        window.location.href =
                            "project.html?id=" + newProjectId;

                    },
                    1500
                );


            }
        );


        // =================================
        // HIBA MEGJELENÍTÉSE
        // =================================

        function showError(message) {

            errorMessage.textContent =
                message;

            errorMessage.style.display =
                "block";

        }


    }
);