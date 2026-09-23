import { saveGameSession, clearGameSession, generatePlayGrid } from "./game.js";

export function showGridPopup()
{
    const overlay = document.createElement("div");
    overlay.id = "popup-overlay";

    const popup = document.createElement("div");
    popup.id = "popup-window";

    const title = document.createElement("h2");
    title.textContent = "choose grid size";

    const select = document.createElement("select");
    select.id = "grid-size-select";

    [6, 8, 10].forEach(size =>
    {
        const option = document.createElement("option");
        option.value = size;
        option.textContent = `${size} × ${size}`;
        select.appendChild(option);
    });

    const startButton = document.createElement("button");
    startButton.id = "start-game-button";
    startButton.textContent = "start Game";

    startButton.addEventListener("click", async () =>
    {
        const size = Number(select.value);
        await saveGameSession(size);
        overlay.remove();
        generatePlayGrid(size);
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