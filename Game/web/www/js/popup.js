import { fetchDb } from "./data.js";

// onStart(difficulty) is called when the user clicks the start button in the popup, no need for GET requests here, the difficulty is already known
export function showGridPopup(onStart)
{
    // no multiple popups at the same time
    if (document.querySelector("#popup-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "popup-overlay";

    const popup = document.createElement("div");
    popup.id = "popup-window";

    const title = document.createElement("h2");
    title.textContent = "choose difficulty";

    const select = document.createElement("select");
    select.id = "grid-size-select";

    const startButton = document.createElement("button");
    startButton.id = "start-game-button";
    startButton.type = "button";
    startButton.textContent = "start game";
    startButton.disabled = true; // while the difficulties are being loaded, the button is disabled to prevent starting a game without a difficulty

    let difficulties = [];

    fetchDb("DIFFICULTY")
        .then((loaded) =>
        {
            difficulties = loaded;

            difficulties.forEach((diff) =>
            {
                const option = document.createElement("option");
                option.value = diff.id;
                option.textContent = `${diff.name} (${diff.grid_size}×${diff.grid_size})`;
                select.appendChild(option);
            });

            startButton.disabled = difficulties.length === 0;
        })
        .catch((error) =>
        {
            console.error("Could not load difficulties: ", error);
            title.textContent = "server unreachable";
        });

    startButton.addEventListener("click", async () =>
    {
        const difficulty = difficulties.find((d) => String(d.id) === select.value);

        if (!difficulty)
        {
            console.error("Difficulty not found for id: ", select.value);
            return;
        }

        // against double clicks, the button is disabled immediately after the first click, and re-enabled only if starting the game fails
        startButton.disabled = true;

        try
        {
            await onStart(difficulty);
            overlay.remove();
        }
        catch (error)
        {
            console.error("Could not start game: ", error);
            startButton.disabled = false;
        }
    });

    popup.append(title, select, startButton);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

// generic message window (chest results, errors), uses the same overlay + window as the difficulty popup
export function showMessagePopup(title, lines = [], isError = false)
{
    // no multiple popups at the same time
    if (document.querySelector("#popup-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "popup-overlay";

    const popup = document.createElement("div");
    popup.id = "popup-window";
    popup.setAttribute("role", isError ? "alert" : "dialog");

    const heading = document.createElement("h2");
    heading.textContent = title;
    popup.appendChild(heading);

    lines.forEach((line) =>
    {
        const message = document.createElement("p");
        message.className = isError ? "popup-message popup-message-error" : "popup-message";
        message.textContent = line;
        popup.appendChild(message);
    });

    const closeButton = document.createElement("button");
    closeButton.id = "popup-close-button";
    closeButton.type = "button";
    closeButton.textContent = "ok";

    const onKeyDown = (event) =>
    {
        if (event.key === "Escape" || event.key === "Enter") close();
    };

    function close()
    {
        document.removeEventListener("keydown", onKeyDown);
        overlay.remove();
    }

    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", (event) =>
    {
        if (event.target === overlay) close();
    });
    document.addEventListener("keydown", onKeyDown);

    popup.appendChild(closeButton);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    closeButton.focus();
}

export function addNewGameButton(onClick)
{
    const menu = document.querySelector(".menu-theme");

    const btn = document.createElement("button");
    btn.id = "new-game-button";
    btn.className = "theme-toggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "New game");

    const icon = document.createElement("img");
    icon.src = "./src/restart.svg";
    icon.className = "restart-icon";
    icon.alt = "";

    btn.appendChild(icon);
    menu.prepend(btn);

    btn.addEventListener("click", onClick);
}
