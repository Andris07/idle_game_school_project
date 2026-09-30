import { fetchDb, postDb, deleteDbById } from "./data.js";
import { refreshInventory } from "./app.js";

const SHAPE_SIZE = 4;
const DRAG_START_DISTANCE = 4;
const AUTO_SCROLL_EDGE = 48;
const AUTO_SCROLL_SPEED = 10;

const inventoryElement = document.querySelector("#inventory");
const playgridElement = document.querySelector("#playgrid");

let placements = [];
let occupied = new Map();
let nextPlacementId = 0;
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

async function loadPlacements()
{
    const token = ++boardLoadToken;
    let rawPlacements = [];

    try
    {
        rawPlacements = await fetchDb("PLACEMENT");
    }
    catch (error)
    {
        console.error("Could not load placements: ", error);
    }

    if (token !== boardLoadToken) return;

    if (!Array.isArray(rawPlacements))
    {
        rawPlacements = [];
    }

    nextPlacementId = rawPlacements.reduce((maxId, placement) => Math.max(maxId, Number(placement?.id) || 0), -1) + 1;

    placements = rawPlacements.filter(isValidPlacement);
    renderPlacements();
}

new MutationObserver(() =>
{
    if (getBoard()) loadPlacements();
}).observe(playgridElement, { childList: true });

if (getBoard()) loadPlacements();

function readInventoryItem(itemElement)
{
    try
    {
        const cells = JSON.parse(itemElement.dataset.cells);
        const inventoryItemId = itemElement.dataset.inventoryItemId;

        if (!Array.isArray(cells) || inventoryItemId === undefined) return null;

        return {
            inventoryItemId,
            shapeId: itemElement.dataset.shapeId,
            value: Number(itemElement.dataset.value),
            cells,
        };
    }
    catch (error)
    {
        return null;
    }
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
        const board = getBoard();

        if (!board) return;

        const absoluteCells = getAbsoluteCells(data.cells, target.originColumn, target.originRow);

        if (!checkPlacement(board, absoluteCells).valid) return;

        const placement =
        {
            id: nextPlacementId,
            shape_id: data.shapeId,
            value: data.value,
            cells: data.cells,
            x_coord: target.originColumn,
            y_coord: target.originRow,
        };

        const saved = await postDb("PLACEMENT", placement);

        if (!saved || saved.id === undefined)
        {
            throw new Error("PLACEMENT was not saved");
        }

        savedPlacement = saved;

        const removed = await deleteDbById("INVENTORY_ITEM", data.inventoryItemId);

        if (!removed)
        {
            throw new Error("INVENTORY_ITEM was not removed");
        }

        placements.push(placement);
        nextPlacementId += 1;
        savedPlacement = null;
        renderPlacements();
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
