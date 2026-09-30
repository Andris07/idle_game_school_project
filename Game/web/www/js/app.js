import { fetchDb, postDb, putDbById } from "./data.js";

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
			return shape ? {
				...shape,
				value: item.value,
				inventoryItemId: item.id,
				cells: item.cells ?? shape.cells,
			} : null;
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
		console.error("Could not load inventory: ", error);
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

		rotateButton.addEventListener("click", async () => {
			rotateButton.disabled = true;
			const rotatedCells = shape.cells.map(([column, row]) => [3 - row, column]);

			try {
				await putDbById("INVENTORY_ITEM", shape.inventoryItemId, {
					id: shape.inventoryItemId,
					shape_id: shape.id,
					value: shape.value,
					cells: rotatedCells,
				});
				shape.cells = rotatedCells;
				fillInventory();
			} catch (error) {
				console.error("Could not rotate inventory item: ", error);
				rotateButton.disabled = false;
			}
		});

		item.append(grid, value, rotateButton);
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
		console.error("Could not save inventory item: ", error);
	} finally {
		shapeChestButton.disabled = inventory.length >= maxInventoryItems;
	}
});
