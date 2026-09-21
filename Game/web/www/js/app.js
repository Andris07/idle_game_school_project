import { fetchDb } from "./data.js";

let tetrisShapes = [];
const inventoryElement = document.querySelector("#inventory");
const inventory = [];
const shapeChestButton = document.querySelector("#shape-chest-button");
const maxInventoryItems = 8;

fetchDb("SHAPE")
	.then((data) => {
		tetrisShapes = data;
		shapeChestButton.disabled = false;
	})
	.catch((error) => {
		console.error("Could not load shapes:", error);
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
	name.textContent = shape.name;
	item.append(grid, name);
	inventoryElement.appendChild(item);
	});
}

shapeChestButton.addEventListener("click", () => {
	const shape = tetrisShapes[Math.floor(Math.random() * tetrisShapes.length)];
	inventory.push(shape);
	fillInventory();
	shapeChestButton.disabled = inventory.length >= maxInventoryItems;
});
