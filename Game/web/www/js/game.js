import { BASE_URL, fetchDb, postDb, putDb, deleteDbById } from "./data.js";
import { showGridPopup, addNewGameButton } from "./popup.js";
import { startMoneySystem, stopMoneySystem } from "./money.js";

const playgrid = document.querySelector("#playgrid");

export async function loadGameSession()
{
    const session = await fetchDb("GAME_SESSION");

    if (session == null || session.difficulty_id == null)
    {
        return null;
    }

    const difficulties = await fetchDb("DIFFICULTY");
    const difficulty = difficulties.find(d => d.id === session.difficulty_id);

    return difficulty?.grid_size || null;
}

export async function saveGameSession(difficulty_id)
{
    await putDb("GAME_SESSION",
    {
        id: "0",
        difficulty_id,
        money: 100,
        last_save_at: "",
    });

    await startMoneySystem();
}

export async function clearGameSession()
{
    stopMoneySystem();

    await putDb("GAME_SESSION",
    {
        id: "0",
        difficulty_id: null,
        money: 0,
        last_save_at: ""
    });

    const items = await fetchDb("INVENTORY_ITEM");

    await Promise.all(items.map(item => deleteDbById("INVENTORY_ITEM", item.id)));

    const placements = await fetchDb("PLACEMENT");

    await Promise.all(placements.map(placement => deleteDbById("PLACEMENT", placement.id)));
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
    }
    else
    {
        await startMoneySystem();
        generatePlayGrid(size);
    }
})();