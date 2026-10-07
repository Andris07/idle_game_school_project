import { fetchDb, putDb, putDbById, deleteDbById } from "./data.js";
import { showGridPopup, addNewGameButton } from "./popup.js";
import { startMoneySystem, stopMoneySystem, waitForPendingSaves } from "./money.js";
import { refreshInventory } from "./app.js";
import { loadPlacements, resetPlacements } from "./placement.js";
import "./chests.js";

const STARTING_MONEY = 100;

const playgrid = document.querySelector("#playgrid");

let isRestarting = false;

function createSession(difficulty_id = null, money = 0)
{
    return { id: "0", difficulty_id, money, last_save_at: "" };
}

export async function loadGameSession()
{
    const session = await fetchDb("GAME_SESSION");

    if (session == null || session.difficulty_id == null)
    {
        return null;
    }

    const difficulties = await fetchDb("DIFFICULTY");
    const difficulty = difficulties.find((d) => String(d.id) === String(session.difficulty_id));

    return difficulty?.grid_size || null;
}

export async function saveGameSession(difficulty_id)
{
    await putDb("GAME_SESSION", createSession(difficulty_id, STARTING_MONEY));

    await startMoneySystem();
}

export async function clearGameSession()
{
    stopMoneySystem();
    await waitForPendingSaves();

    await putDb("GAME_SESSION", createSession());

    const [items, placements, shapes] = await Promise.all([
        fetchDb("INVENTORY_ITEM"),
        fetchDb("PLACEMENT"),
        fetchDb("SHAPE"),
    ]);

    const results = await Promise.allSettled([
        ...items.map((item) => deleteDbById("INVENTORY_ITEM", item.id)),
        ...placements.map((placement) => deleteDbById("PLACEMENT", placement.id)),
        ...shapes.map((shape) => putDbById("SHAPE", shape.id, {...shape, base_value: 0,})),
    ]);

    const failed = results.filter((result) => result.status === "rejected");

    if (failed.length > 0)
    {
        throw new Error(`${failed.length} item(s) could not be reset while clearing the game`);
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

async function startGame(difficulty)
{
    await saveGameSession(difficulty.id);
    generatePlayGrid(difficulty.grid_size);
    await loadPlacements();
}

async function restartGame()
{
    if (isRestarting) return;
    isRestarting = true;

    try
    {
        await clearGameSession();
    }
    catch (error)
    {
        console.error("Could not clear game session: ", error);
    }

    // old data should not be displayed while the new game is being set up, so we clear the grid and reset placements
    playgrid.replaceChildren();
    resetPlacements();

    try
    {
        await refreshInventory();
    }
    catch (error)
    {
        console.error("Could not refresh inventory: ", error);
    }

    isRestarting = false;
    showGridPopup(startGame);
}

(async function initGame()
{
    addNewGameButton(restartGame);

    try
    {
        const size = await loadGameSession();

        if (!size)
        {
            showGridPopup(startGame);
            return;
        }

        await startMoneySystem();
        generatePlayGrid(size);
        await loadPlacements();
    }
    catch (error)
    {
        console.error("Could not start game: ", error);
    }
})();
