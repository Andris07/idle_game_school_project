import { fetchDb } from "./data.js";
import { showMessagePopup } from "./popup.js";
import { getMoney, getGameSession, getPausedMs, formatMoney } from "./money.js";
import { getBoardSnapshot } from "./placement.js";
import { getInventoryShapes, getBaseShapes } from "./app.js";
import { isGridFrozen } from "./events.js";

// Game over: none of the shapes in the inventory can be placed on the board anymore (in any rotation),
// because the empty cells that are left do not form the shape of any of them.
// If the inventory is empty, the game is over when none of the 7 shapes fits on the board anymore (nothing could ever be placed again).
//
// After the check: game over message -> result window -> automatic restart (the difficulty popup).

const SHAPE_SIZE = 4;

let gameOverTriggered = false;
let onRestart = null;

// onRestart() is called after the result window was closed, it has to start a new game (clear + difficulty popup)
export function initGameOver(options)
{
    onRestart = options.onRestart;
}

// called when a new game is set up
export function resetGameOver()
{
    gameOverTriggered = false;
}

// the cells of a shape are inside a 4x4 box, rotating clockwise is the same as the rotate button of the inventory
function rotate(cells)
{
    return cells.map(([column, row]) => [SHAPE_SIZE - 1 - row, column]);
}

// moves the shape to the top-left corner of its box, so it can be tried at every position of the board
function normalize(cells)
{
    const minColumn = Math.min(...cells.map(([column]) => column));
    const minRow = Math.min(...cells.map(([, row]) => row));

    return cells.map(([column, row]) => [column - minColumn, row - minRow]);
}

function canPlaceAnywhere(cells, size, occupied)
{
    let current = cells;

    for (let rotation = 0; rotation < 4; rotation += 1)
    {
        const shape = normalize(current);
        const width = Math.max(...shape.map(([column]) => column)) + 1;
        const height = Math.max(...shape.map(([, row]) => row)) + 1;

        for (let top = 0; top + height <= size; top += 1)
        {
            for (let left = 0; left + width <= size; left += 1)
            {
                if (shape.every(([column, row]) => !occupied.has(`${left + column},${top + row}`)))
                {
                    return true;
                }
            }
        }

        current = rotate(current);
    }

    return false;
}

function formatPlayTime(milliseconds)
{
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
    if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;

    return `${seconds}s`;
}

// the result is collected before the first popup, so the numbers do not change while the player reads the messages
async function collectResult(boardSize)
{
    const session = getGameSession();
    let difficultyText = `${boardSize}×${boardSize}`;

    try
    {
        const difficulties = await fetchDb("DIFFICULTY");
        const difficulty = difficulties.find((d) => String(d.id) === String(session?.difficulty_id));

        if (difficulty) difficultyText = `${difficulty.name} (${difficulty.grid_size}×${difficulty.grid_size})`;
    }
    catch (error)
    {
        console.error("Could not load the difficulty for the result: ", error);
    }

    const startedAt = Date.parse(session?.started_at);
    const playTime = Number.isFinite(startedAt) ? formatPlayTime(Date.now() - startedAt - getPausedMs()) : "-";

    return [
        ["Difficulty", difficultyText],
        ["Money", `${formatMoney(getMoney())} $`],
        ["Time played", playTime],
    ];
}

// Checks if the game is over and runs the game over sequence if it is. It never throws.
export async function checkGameOver()
{
    try
    {
        if (gameOverTriggered) return false;

        // frozen rows and columns are cleared when the freeze ends, which frees up cells, so the game cannot end before that
        if (isGridFrozen()) return false;

        const board = getBoardSnapshot();

        if (!board) return false;

        const inventory = getInventoryShapes();

        // if the inventory is not full, there is a chance that the player can get a placeable shape

        if (inventory.length !== 8) return false;

        const candidates = inventory.length > 0 ? inventory : await getBaseShapes();

        if (candidates.some((shape) => canPlaceAnywhere(shape.cells, board.size, board.occupied))) return false;

        // the check above has an await, so another check could have won in the meantime
        if (gameOverTriggered) return false;
        gameOverTriggered = true;

        const result = await collectResult(board.size);

        const lines = inventory.length > 0
            ? [
                "None of your shapes can be placed anymore.",
                "The empty cells that are left do not form the shape of any of them.",
            ]
            : [
                "No shape can be placed on the board anymore.",
                "The empty cells that are left are too scattered for any shape.",
            ];

        showMessagePopup("Game over",
        lines,
        true,
        {
            dismissible: false,
            onClose: () =>
            {
                showMessagePopup("Your result", [], false,
                {
                    rows: result,
                    closeLabel: "new game",
                    dismissible: false,
                    onClose: () => onRestart?.(),
                });
            },
        });

        return true;
    }
    catch (error)
    {
        console.error("Could not check if the game is over: ", error);
        return false;
    }
}
