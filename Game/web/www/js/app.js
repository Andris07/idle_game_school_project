import { fetchDb, postDb } from "./data.js";

let tetrisShapes = [];
let nextInventoryId = 0;
const inventoryElement = document.querySelector("#inventory");
const inventory = [];
const shapeChestButton = document.querySelector("#shape-chest-button");
const maxInventoryItems = 8;

async function refreshInventory() {
	const items = await fetchDb("INVENTORY_ITEM");
	nextInventoryId = items.reduce(
		(maxId, item) => Math.max(maxId, Number(item.id) || 0),
		-1
	) + 1;

	const shapesInInventory = items
		.map((item) => {
			const shape = tetrisShapes.find(
				(shape) => Number(shape.id) === Number(item.shape_id)
			);
			return shape ? { ...shape, value: item.value } : null;
		})
		.filter(Boolean);
	inventory.splice(0, inventory.length, ...shapesInInventory);
	fillInventory();
}

Promise.all([fetchDb("SHAPE"), fetchDb("INVENTORY_ITEM")])
	.then(([shapes]) => {
		tetrisShapes = shapes;
		return refreshInventory();
	})
	.catch((error) => {
		console.error("Could not load inventory:", error);
	});

function fillInventory() {
	inventoryElement.replaceChildren();

	inventory.forEach((shape) => {
		const item = document.createElement("div");
		item.className = "inventory-item";
		item.setAttribute("aria-label", `${shape.name} shape`);

		const grid = document.createElement("div");
		grid.className = "shape-grid";
		const filledCells = new Set(shape.cells.map(([column, row]) => `${column},${row}`));

		for (let row = 0; row < 4; row += 1) {
			for (let column = 0; column < 4; column += 1) {
				const cell = document.createElement("div");
				cell.className = "shape-cell";
				if (filledCells.has(`${column},${row}`)) {
					cell.classList.add("shape-cell-filled");
				}
				grid.appendChild(cell);
			}
		}

		const name = document.createElement("strong");
		name.textContent = `${shape.name}`;
		const value = document.createElement("p");
		value.textContent = `Value: ${shape.value}`;

		item.append(grid, name, value);
		inventoryElement.appendChild(item);
	});
}

shapeChestButton.addEventListener("click", async () => {
	const shape = tetrisShapes[Math.floor(Math.random() * tetrisShapes.length)];
	shapeChestButton.disabled = true;
	if (inventory.length >= maxInventoryItems) {
		alert("Inventory is full! Please remove an item before adding a new one.");
		shapeChestButton.disabled = false;
		return;
	}
	try {
		await postDb("INVENTORY_ITEM", {
			id: nextInventoryId,
			shape_id: shape.id,
			value: shape.base_value + Math.floor(Math.random() * 50),
		});
		await refreshInventory();
	} catch (error) {
		console.error("Could not save inventory item:", error);
	} finally {
		shapeChestButton.disabled = inventory.length >= maxInventoryItems;
	}
});
