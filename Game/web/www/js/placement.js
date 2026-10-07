import { fetchDb, postDb, putDbById, deleteDbById } from "./data.js";
import { refreshInventory, getInventoryItem } from "./app.js";
import { addMoney, updatePassiveIncome } from "./money.js";

const SHAPE_SIZE = 4;
const DRAG_START_DISTANCE = 4;
const AUTO_SCROLL_EDGE = 48;
const AUTO_SCROLL_SPEED = 10;

const inventoryElement = document.querySelector("#inventory");
const playgridElement = document.querySelector("#playgrid");

let placements = [];
let occupied = new Map();
let boardLoadToken = 0;
let previewCells = [];
let drag = null;
let isSaving = false;

function cellKey(column, row)
{
    return `${column},${row}`;
}

function getBoard()
{
    const grid = playgridElement.querySelector(".playgrid-grid");

    if (!grid) return null;

    const cells = Array.from(grid.querySelectorAll(".play-cell"));
    const size = Math.round(Math.sqrt(cells.length));

    if (size < 2 || size * size !== cells.length) return null;

    return { grid, cells, size };
}

function getBoardMetrics(board)
{
    const first = board.cells[0].getBoundingClientRect();
    const right = board.cells[1].getBoundingClientRect();
    const below = board.cells[board.size].getBoundingClientRect();

    return {
        left: first.left,
        top: first.top,
        cellWidth: first.width,
        cellHeight: first.height,
        pitchX: right.left - first.left,
        pitchY: below.top - first.top,
    };
}

function getAbsoluteCells(localCells, originColumn, originRow)
{
    return localCells.map(([column, row]) => [originColumn + column, originRow + row]);
}

function isInsideBoard(board, column, row)
{
    return column >= 0 && column < board.size && row >= 0 && row < board.size;
}

function checkPlacement(board, absoluteCells)
{
    let valid = true;
    let insideCount = 0;

    for (const [column, row] of absoluteCells)
    {
        if (!isInsideBoard(board, column, row))
        {
            valid = false;
            continue;
        }

        insideCount += 1;

        if (occupied.has(cellKey(column, row)))
        {
            valid = false;
        }
    }

    return { valid, insideCount };
}

function getCompletedLines(board, absoluteCells)
{
    const newCells = new Set(absoluteCells.map(([column, row]) => cellKey(column, row)));
    const isOccupied = (column, row) =>
        occupied.has(cellKey(column, row)) || newCells.has(cellKey(column, row));
    const indices = Array.from({ length: board.size }, (_, index) => index);

    return {
        rows: indices.filter((row) => indices.every((column) => isOccupied(column, row))),
        columns: indices.filter((column) => indices.every((row) => isOccupied(column, row))),
    };
}

// row/column reward is the sum of the values of all shapes that have at least one cell in the row/column, multiplied by the number of shapes that have at least one cell in the row/column
function getLineReward(isInLine)
{
    const shapes = placements.filter((placement) =>
        placement.cells.some(([column, row]) =>
            isInLine(Number(placement.x_coord) + column, Number(placement.y_coord) + row)));

    const totalValue = shapes.reduce((total, placement) => total + (Number(placement.value) || 0), 0);

    return totalValue * shapes.length;
}

function getCompletedLineReward(completedLines, boardSize)
{
    const inBoard = (value) => value >= 0 && value < boardSize;

    const lineRewards = [
        ...completedLines.rows.map((line) => getLineReward((x, y) => y === line && inBoard(x))),
        ...completedLines.columns.map((line) => getLineReward((x, y) => x === line && inBoard(y))),
    ];

    if (lineRewards.length === 0) return 0;

    const totalReward = lineRewards.reduce((total, reward) => total + reward, 0);
    const comboMultiplier = Math.max(2, 1 + 0.25 * (lineRewards.length - 1));

    return totalReward * comboMultiplier;
}

async function clearCompletedLines(completedLines)
{
    const rows = new Set(completedLines.rows);
    const columns = new Set(completedLines.columns);
    const operations = [];

    for (const placement of placements)
    {
        const remainingCells = placement.cells.filter(([column, row]) =>
            !rows.has(Number(placement.y_coord) + row)
            && !columns.has(Number(placement.x_coord) + column));

        if (remainingCells.length === placement.cells.length) continue;

        operations.push(remainingCells.length === 0
            ? deleteDbById("PLACEMENT", placement.id)
            : putDbById("PLACEMENT", placement.id, { ...placement, cells: remainingCells }));
    }

    if (operations.length === 0)
    {
        renderPlacements();
        return;
    }

    // a failed placement can't mess up the game state, because we always reload placements from the server after placing a shape, so we can just log the error and continue
    const results = await Promise.allSettled(operations);

    if (results.some((result) => result.status === "rejected"))
    {
        console.error("Some placements could not be cleared: ", results);
    }

    await loadPlacements();
}

function isValidPlacement(placement)
{
    return placement
        && Array.isArray(placement.cells)
        && Number.isFinite(Number(placement.x_coord))
        && Number.isFinite(Number(placement.y_coord));
}

function renderPlacements()
{
    const board = getBoard();
    occupied = new Map();

    if (!board) return;

    board.cells.forEach((cell) =>
    {
        cell.classList.remove("play-cell-filled");
        delete cell.dataset.placementId;
    });

    placements.forEach((placement) =>
    {
        const absoluteCells = getAbsoluteCells(placement.cells, Number(placement.x_coord), Number(placement.y_coord));

        absoluteCells.forEach(([column, row]) =>
        {
            if (!isInsideBoard(board, column, row)) return;

            const cell = board.cells[row * board.size + column];
            cell.classList.add("play-cell-filled");
            cell.dataset.placementId = placement.id;
            occupied.set(cellKey(column, row), placement.id);
        });
    });
}

export function resetPlacements()
{
    boardLoadToken += 1;
    placements = [];
    occupied = new Map();
}

// server state is the source of truth, so we always reload placements from the server when starting a new game or after placing a shape
export async function loadPlacements()
{
    const token = ++boardLoadToken;
    const rawPlacements = await fetchDb("PLACEMENT");

    if (token !== boardLoadToken) return;

    placements = Array.isArray(rawPlacements) ? rawPlacements.filter(isValidPlacement) : [];
    renderPlacements();
}

function readInventoryItem(itemElement)
{
    const inventoryItemId = itemElement.dataset.inventoryItemId;

    if (inventoryItemId === undefined) return null;

    return getInventoryItem(inventoryItemId);
}

inventoryElement.addEventListener("pointerdown", (event) =>
{
    if (drag || isSaving || !event.isPrimary) return;

    if (event.pointerType === "mouse" && event.button !== 0) return;

    const shapeGrid = event.target.closest(".shape-grid");
    const itemElement = shapeGrid?.closest(".inventory-item");

    if (!itemElement || !getBoard()) return;

    const data = readInventoryItem(itemElement);

    if (!data) return;

    event.preventDefault();

    const rect = shapeGrid.getBoundingClientRect();

    drag = {
        pointerId: event.pointerId,
        itemElement,
        data,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        grabRatioX: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
        grabRatioY: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
        started: false,
        ghost: null,
        target: null,
        frameId: 0,
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);
    document.addEventListener("keydown", onKeyDown);
});

function onPointerMove(event)
{
    if (!drag || event.pointerId !== drag.pointerId) return;

    drag.x = event.clientX;
    drag.y = event.clientY;

    if (!drag.started)
    {
        const distance = Math.hypot(drag.x - drag.startX, drag.y - drag.startY);

        if (distance < DRAG_START_DISTANCE) return;

        startDrag();
    }
}

async function onPointerUp(event)
{
    if (!drag || event.pointerId !== drag.pointerId) return;

    const finished = drag;
    const target = finished.started ? finished.target : null;

    endDrag();

    if (target && target.valid)
    {
        await dropOnBoard(finished.data, target);
    }
}

function onPointerCancel(event)
{
    if (drag && event.pointerId === drag.pointerId) endDrag();
}

function onKeyDown(event)
{
    if (event.key === "Escape") endDrag();
}

function startDrag()
{
    const board = getBoard();

    if (!board)
    {
        endDrag();
        return;
    }

    const metrics = getBoardMetrics(board);
    const filledCells = new Set(drag.data.cells.map(([column, row]) => cellKey(column, row)));

    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.style.gridTemplateColumns = `repeat(${SHAPE_SIZE}, ${metrics.cellWidth}px)`;
    ghost.style.gridTemplateRows = `repeat(${SHAPE_SIZE}, ${metrics.cellHeight}px)`;
    ghost.style.columnGap = `${metrics.pitchX - metrics.cellWidth}px`;
    ghost.style.rowGap = `${metrics.pitchY - metrics.cellHeight}px`;

    for (let row = 0; row < SHAPE_SIZE; row += 1)
    {
        for (let column = 0; column < SHAPE_SIZE; column += 1)
        {
            const cell = document.createElement("div");
            cell.className = "drag-ghost-cell";

            if (filledCells.has(cellKey(column, row)))
            {
                cell.classList.add("drag-ghost-cell-filled");
            }

            ghost.appendChild(cell);
        }
    }

    document.body.appendChild(ghost);

    drag.started = true;
    drag.ghost = ghost;
    drag.itemElement.classList.add("inventory-item-dragging");
    document.body.classList.add("is-dragging");

    dragFrame();
}

function dragFrame()
{
    if (!drag || !drag.started) return;

    if (drag.y < AUTO_SCROLL_EDGE)
    {
        window.scrollBy(0, -AUTO_SCROLL_SPEED);
    }
    else if (drag.y > window.innerHeight - AUTO_SCROLL_EDGE)
    {
        window.scrollBy(0, AUTO_SCROLL_SPEED);
    }

    updateDrag();
    drag.frameId = requestAnimationFrame(dragFrame);
}

function updateDrag()
{
    const board = getBoard();

    if (!board) return;

    const metrics = getBoardMetrics(board);
    const ghostWidth = (SHAPE_SIZE - 1) * metrics.pitchX + metrics.cellWidth;
    const ghostHeight = (SHAPE_SIZE - 1) * metrics.pitchY + metrics.cellHeight;

    const ghostLeft = drag.x - drag.grabRatioX * ghostWidth;
    const ghostTop = drag.y - drag.grabRatioY * ghostHeight;

    drag.ghost.style.transform = `translate(${ghostLeft}px, ${ghostTop}px)`;

    const originColumn = Math.round((ghostLeft - metrics.left) / metrics.pitchX);
    const originRow = Math.round((ghostTop - metrics.top) / metrics.pitchY);

    const absoluteCells = getAbsoluteCells(drag.data.cells, originColumn, originRow);
    const { valid, insideCount } = checkPlacement(board, absoluteCells);

    drag.target = { originColumn, originRow, valid };

    clearPreview();

    absoluteCells.forEach(([column, row]) =>
    {
        if (!isInsideBoard(board, column, row)) return;

        const cell = board.cells[row * board.size + column];
        cell.classList.add(valid ? "play-cell-preview-valid" : "play-cell-preview-invalid");
        previewCells.push(cell);
    });

    drag.ghost.classList.toggle("drag-ghost-valid", insideCount > 0 && valid);
    drag.ghost.classList.toggle("drag-ghost-invalid", insideCount > 0 && !valid);
}

function clearPreview()
{
    previewCells.forEach((cell) =>
    {
        cell.classList.remove("play-cell-preview-valid", "play-cell-preview-invalid");
    });

    previewCells = [];
}

function endDrag()
{
    if (!drag) return;

    cancelAnimationFrame(drag.frameId);

    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerCancel);
    document.removeEventListener("keydown", onKeyDown);

    drag.ghost?.remove();
    drag.itemElement.classList.remove("inventory-item-dragging");
    document.body.classList.remove("is-dragging");
    clearPreview();

    drag = null;
}

async function dropOnBoard(data, target)
{
    if (isSaving) return;

    isSaving = true;
    let savedPlacement = null;

    try
    {
        // before placing a shape, we need to make sure we have the latest placements from the server, otherwise we might place a shape on top of another one that was placed by another client
        await loadPlacements();

        const board = getBoard();

        if (!board) return;

        const absoluteCells = getAbsoluteCells(data.cells, target.originColumn, target.originRow);

        if (!checkPlacement(board, absoluteCells).valid) return;

        const completedLines = getCompletedLines(board, absoluteCells);

        // generating id is done by the server, so we don't need to generate it on the client side (otherwise possible errors could lead to unmatching ids between client and server)
        savedPlacement = await postDb("PLACEMENT",
        {
            shape_id: data.shapeId,
            value: data.value,
            cells: data.cells,
            x_coord: target.originColumn,
            y_coord: target.originRow,
        });

        if (!savedPlacement || savedPlacement.id === undefined)
        {
            throw new Error("PLACEMENT was not saved");
        }

        await deleteDbById("INVENTORY_ITEM", data.inventoryItemId);

        placements.push(savedPlacement);
        savedPlacement = null;

        // calculating the reward before clearing the lines, because clearCompletedLines() will modify placements
        const lineReward = getCompletedLineReward(completedLines, board.size);

        await clearCompletedLines(completedLines);
        updatePassiveIncome(placements);

        if (lineReward > 0)
        {
            await addMoney(lineReward);
        }
    }
    catch (error)
    {
        console.error("Could not place shape: ", error);

        if (savedPlacement)
        {
            try
            {
                await deleteDbById("PLACEMENT", savedPlacement.id);
            }
            catch (rollbackError)
            {
                console.error("Could not roll back placement: ", rollbackError);
            }
        }

        // display server state to the user, so they can try again with the correct data
        try
        {
            await loadPlacements();
        }
        catch (reloadError)
        {
            console.error("Could not reload placements: ", reloadError);
        }
    }
    finally
    {
        isSaving = false;

        try
        {
            await refreshInventory();
        }
        catch (error)
        {
            console.error("Could not refresh inventory: ", error);
        }
    }
}
