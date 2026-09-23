import { saveGameSession, clearGameSession, generatePlayGrid } from "./game.js";
import { fetchDb } from "./data.js";

export function showGridPopup()
{
    const overlay = document.createElement("div");
    overlay.id = "popup-overlay";

    const popup = document.createElement("div");
    popup.id = "popup-window";

    const title = document.createElement("h2");
    title.textContent = "choose difficulty";

    const select = document.createElement("select");
    select.id = "grid-size-select";

    let loadedDifficulties = null;

    // loading DIFFICULTY
    fetchDb("DIFFICULTY").then(difficulties =>
    {
        loadedDifficulties = difficulties;

        difficulties.forEach(diff =>
        {
            const option = document.createElement("option");
            option.value = diff.id;
            option.textContent = `${diff.name} (${diff.grid_size}×${diff.grid_size})`;
            select.appendChild(option);
        });
    });

    const startButton = document.createElement("button");
    startButton.id = "start-game-button";
    startButton.textContent = "start game";

    startButton.addEventListener("click", async () =>
    {
        // if DIFFICULTY is not loaded → don't allow the user to start the game
        if (!loadedDifficulties)
        {
            console.error("Difficulty list not loaded yet");
            return;
        }

        const difficulty_id = select.value;
        const difficulty = loadedDifficulties.find(d => d.id == difficulty_id);

        if (!difficulty)
        {
            console.error("Difficulty not found for id: ", difficulty_id);
            return;
        }

        await saveGameSession(difficulty_id);

        overlay.remove();
        generatePlayGrid(difficulty.grid_size);
    });

    popup.append(title, select, startButton);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

export function addNewGameButton()
{
    const menu = document.querySelector(".menu-theme");

    const btn = document.createElement("button");
    btn.id = "new-game-button";
    btn.className = "theme-toggle";

    const icon = document.createElement("img");
    icon.src = "./src/restart.svg";
    icon.className = "restart-icon";

    btn.appendChild(icon);
    menu.prepend(btn);

    btn.addEventListener("click", async () =>
    {
        await clearGameSession();
        showGridPopup();
    });
}