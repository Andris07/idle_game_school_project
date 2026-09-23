import { BASE_URL, fetchDb, postDb, } from "./data.js";
import { showGridPopup, addNewGameButton } from "./popup.js";

const playgrid = document.querySelector("#playgrid");

export async function loadGameSession()
{
    const session = await fetchDb("GAME_SESSION");
    return session?.grid_size || null;
}

export async function saveGameSession(size)
{
    await postDb("GAME_SESSION", { grid_size: size });
}

export async function clearGameSession()
{
    try
    {
        await deleteDb("GAME_SESSION");
    }
    catch (e)
    {
        console.warn("GAME_SESSION already empty");
    }

    try
    {
        await deleteDb("INVENTORY_ITEM");
    }
    catch (e)
    {
        console.warn("INVENTORY_ITEM already empty");
    }
}

export function generatePlayGrid(size)
{
    playgrid.replaceChildren();

    const grid = document.createElement("div");
    grid.className = "playgrid-grid";

    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${size}, 1fr)`;
    grid.style.gap = "3px";

    for (let i = 0; i < size * size; i++)
    {
        const cell = document.createElement("div");
        cell.className = "play-cell";
        grid.appendChild(cell);
    }

    playgrid.appendChild(grid);
}

(async function initGame()
{
    addNewGameButton();

    const size = await loadGameSession();

    if (!size)
    {
        showGridPopup();
    } else
    {
        generatePlayGrid(size);
    }
})();
