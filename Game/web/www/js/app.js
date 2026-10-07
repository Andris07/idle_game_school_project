import { fetchDb, postDb, putDbById } from "./data.js";
import { addMoney, spendMoney } from "./money.js";

const MAX_INVENTORY_ITEMS = 8;
const SHAPE_CHEST_COST = 100;

const inventoryElement = document.querySelector("#inventory");
const shapeChestButton = document.querySelector("#shape-chest-button");

let tetrisShapesPromise = null;
let inventory = [];
let refreshToken = 0;

shapeChestButton.textContent = `${SHAPE_CHEST_COST} $`;

// loading shapes from the database is done only once, and the result is cached in tetrisShapesPromise
function loadShapes()
{
    tetrisShapesPromise ??= fetchDb("SHAPE").catch((error) =>
    {
        tetrisShapesPromise = null; // if the request fails, we want to be able to retry it later
        console.error("Could not load shapes: ", error);
        throw error;
    });

    return tetrisShapesPromise;
}

function updateChestButton()
{
    shapeChestButton.disabled = inventory.length >= MAX_INVENTORY_ITEMS;
}

// placement.js reads from this instead of the DOM
export function getInventoryItem(inventoryItemId)
{
    const shape = inventory.find((item) => String(item.inventoryItemId) === String(inventoryItemId));

    if (!shape) return null;

    return {
        inventoryItemId: shape.inventoryItemId,
        shapeId: shape.id,
        value: Number(shape.value),
        cells: shape.cells,
    };
}

export async function refreshInventory()
{
    const token = ++refreshToken;
    const [shapes, items] = await Promise.all([loadShapes(), fetchDb("INVENTORY_ITEM")]);

    // check if the token is still valid, if not, we don't want to update the inventory with stale data
    if (token !== refreshToken) return;

    inventory = items.map((item) =>
    {
        const shape = shapes.find((s) => String(s.id) === String(item.shape_id));

        return shape ?
        {
            ...shape,
            value: item.value,
            inventoryItemId: item.id,
            cells: item.cells ?? shape.cells,
        } : null;
    }).filter(Boolean);

    fillInventory();
    updateChestButton();
}

refreshInventory().catch((error) =>
{
    console.error("Could not load inventory: ", error);
});

function fillInventory()
{
    inventoryElement.replaceChildren();

    inventory.forEach((shape) =>
    {
        const item = document.createElement("div");
        item.className = "inventory-item";
        item.setAttribute("aria-label", `${shape.name} shape`);
        item.dataset.inventoryItemId = shape.inventoryItemId;

        const grid = document.createElement("div");
        grid.className = "shape-grid";
        const filledCells = new Set(shape.cells.map(([column, row]) => `${column},${row}`));

        for (let row = 0; row < 4; row += 1)
        {
            for (let column = 0; column < 4; column += 1)
            {
                const cell = document.createElement("div");
                cell.className = "shape-cell";

                if (filledCells.has(`${column},${row}`))
                {
                    cell.classList.add("shape-cell-filled");
                }
                grid.appendChild(cell);
            }
        }

        const value = document.createElement("p");
        value.textContent = `${shape.value}$`;

        const rotateButton = document.createElement("button");
        rotateButton.className = "rotate-shape-button";
        rotateButton.type = "button";
        rotateButton.setAttribute("aria-label", `Rotate ${shape.name} shape`);

        const rotateIcon = document.createElement("img");
        rotateIcon.className = "rotate-icon";
        rotateIcon.src = "./src/rotate.svg";
        rotateIcon.alt = "";
        rotateButton.appendChild(rotateIcon);

        rotateButton.addEventListener("click", async () =>
        {
            rotateButton.disabled = true;
            const rotatedCells = shape.cells.map(([column, row]) => [3 - row, column]);

            try
            {
                await putDbById("INVENTORY_ITEM", shape.inventoryItemId,
                {
                    id: shape.inventoryItemId,
                    shape_id: shape.id,
                    value: shape.value,
                    cells: rotatedCells,
                });

                shape.cells = rotatedCells;
                fillInventory();
            }
            catch (error)
            {
                console.error("Could not rotate inventory item: ", error);
                rotateButton.disabled = false;
            }
        });

        item.append(grid, value, rotateButton);
        inventoryElement.appendChild(item);
    });
}

shapeChestButton.addEventListener("click", async () =>
{
    if (inventory.length >= MAX_INVENTORY_ITEMS)
    {
        alert("Inventory is full! Please remove an item before adding a new one.");
        return;
    }

    shapeChestButton.disabled = true;
    let shouldRefund = false;

    try
    {
        const shapes = await loadShapes();
        const shape = shapes[Math.floor(Math.random() * shapes.length)];

        if (!await spendMoney(SHAPE_CHEST_COST))
        {
            alert(`You need ${SHAPE_CHEST_COST} $ to open this chest.`);
            return;
        }

        shouldRefund = true;

        // id is generated by the database, so we don't need to calculate it here
        await postDb("INVENTORY_ITEM",
        {
            shape_id: shape.id,
            value: shape.base_value + (5 + Math.floor(Math.random() * 5) + 1),
        });

        shouldRefund = false;
        await refreshInventory();
    }
    catch (error)
    {
        console.error("Could not save inventory item: ", error);

        if (shouldRefund)
        {
            try
            {
                await addMoney(SHAPE_CHEST_COST);
            }
            catch (refundError)
            {
                console.error("Could not refund chest cost: ", refundError);
            }
        }
    }
    finally
    {
        updateChestButton();
    }
});
