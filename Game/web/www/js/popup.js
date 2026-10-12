import { fetchDb } from "./data.js";

let gridPopupQueued = false;

// onStart(difficulty) is called when the user clicks the start button in the popup, no need for GET requests here, the difficulty is already known
export function showGridPopup(onStart)
{
    // the difficulty window is never shown (or queued) twice
    if (gridPopupQueued || document.querySelector("#popup-overlay[data-popup='difficulty']")) return;

    gridPopupQueued = true;
    popupQueue.push(() =>
    {
        gridPopupQueued = false;
        buildGridPopup(onStart);
    });
    showNextPopup();
}

function buildGridPopup(onStart)
{
    const overlay = document.createElement("div");
    overlay.id = "popup-overlay";
    overlay.dataset.popup = "difficulty";

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
            popupClosed();
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

// Only one popup is visible at a time. A popup that is opened while another one is showing waits in this queue
// and appears as soon as the visible one is closed (so a game over message can never be lost behind a chest popup).
const popupQueue = [];
let popupVisible = false;

function showNextPopup()
{
    if (popupVisible || popupQueue.length === 0) return;

    popupVisible = true;
    popupQueue.shift()();
}

function popupClosed()
{
    popupVisible = false;
    showNextPopup();
}

// generic message window (chest results, errors, game over), uses the same overlay + window as the difficulty popup
//
// options:
//   icon        - image shown above the title (path)
//   highlight   - a big accented line under the title (e.g. the name of the opened event)
//   rows        - [[label, value], ...] shown as a small table (e.g. the result of the game)
//   closeLabel  - text of the button (default: "ok")
//   dismissible - false: only the button closes it, Escape / Enter / click outside do nothing (default: true)
//   onClose     - called after the window was closed
export function showMessagePopup(title, lines = [], isError = false, options = {})
{
    popupQueue.push(() => buildMessagePopup(title, lines, isError, options));
    showNextPopup();
}

function buildMessagePopup(title, lines, isError, options)
{
    const { icon = null, highlight = null, rows = [], closeLabel = "ok", dismissible = true, onClose = null } = options;

    const overlay = document.createElement("div");
    overlay.id = "popup-overlay";

    const popup = document.createElement("div");
    popup.id = "popup-window";
    popup.classList.toggle("popup-window-error", isError);
    popup.setAttribute("role", isError ? "alert" : "dialog");
    popup.setAttribute("aria-modal", "true");

    if (icon)
    {
        const image = document.createElement("img");
        image.className = "popup-icon";
        image.src = icon;
        image.alt = "";
        popup.appendChild(image);
    }

    const heading = document.createElement("h2");
    heading.textContent = title;
    popup.appendChild(heading);

    if (highlight)
    {
        const highlighted = document.createElement("p");
        highlighted.className = "popup-highlight";
        highlighted.textContent = highlight;
        popup.appendChild(highlighted);
    }

    lines.forEach((line) =>
    {
        const message = document.createElement("p");
        message.className = isError ? "popup-message popup-message-error" : "popup-message";
        message.textContent = line;
        popup.appendChild(message);
    });

    if (rows.length > 0)
    {
        const list = document.createElement("dl");
        list.className = "popup-rows";

        rows.forEach(([label, value]) =>
        {
            const row = document.createElement("div");
            row.className = "popup-row";

            const term = document.createElement("dt");
            term.textContent = label;

            const description = document.createElement("dd");
            description.textContent = value;

            row.append(term, description);
            list.appendChild(row);
        });

        popup.appendChild(list);
    }

    const closeButton = document.createElement("button");
    closeButton.id = "popup-close-button";
    closeButton.type = "button";
    closeButton.textContent = closeLabel;

    let closed = false;

    const onKeyDown = (event) =>
    {
        if (!dismissible)
        {
            // the keyboard can still use the button, but the window is not closed by accident
            if (event.key === "Escape") event.preventDefault();
            return;
        }

        if (event.key === "Escape" || event.key === "Enter")
        {
            event.preventDefault();
            close();
        }
    };

    function close()
    {
        if (closed) return;
        closed = true;

        document.removeEventListener("keydown", onKeyDown);
        overlay.remove();
        popupVisible = false;

        try
        {
            onClose?.();
        }
        catch (error)
        {
            console.error("Popup close handler failed: ", error);
        }

        showNextPopup();
    }

    closeButton.addEventListener("click", close);

    if (dismissible)
    {
        overlay.addEventListener("click", (event) =>
        {
            if (event.target === overlay) close();
        });
    }

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
