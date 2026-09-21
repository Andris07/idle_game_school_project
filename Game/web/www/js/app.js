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

}

shapeChestButton.addEventListener("click", () => {
	const shape = tetrisShapes[Math.floor(Math.random() * tetrisShapes.length)];
	inventory.push(shape);
	fillInventory();
	shapeChestButton.disabled = inventory.length >= maxInventoryItems;
});
