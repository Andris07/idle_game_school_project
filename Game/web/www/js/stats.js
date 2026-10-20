import { fetchDb, putDb } from "./data.js";

const CHEST_KEYS =
{
    shape: "shape_chests",
    upgrade: "upgrade_chests",
    buff: "buff_chests",
};

function emptyStats()
{
    return { id: "0", shape_chests: 0, upgrade_chests: 0, buff_chests: 0, best_combo: 0 };
}

let stats = emptyStats();
let saveQueue = Promise.resolve();

function saveStats()
{
    const snapshot = { ...stats };

    saveQueue = saveQueue
        .then(() => putDb("GAME_STATS", snapshot))
        .catch((error) => console.error("Could not save the statistics: ", error));

    return saveQueue;
}

export async function loadStats()
{
    try
    {
        const record = await fetchDb("GAME_STATS");

        stats =
        {
            id: "0",
            shape_chests: Number(record?.shape_chests) || 0,
            upgrade_chests: Number(record?.upgrade_chests) || 0,
            buff_chests: Number(record?.buff_chests) || 0,
            best_combo: Number(record?.best_combo) || 0,
        };
    }
    catch (error)
    {
        console.error("Could not load the statistics: ", error);
        stats = emptyStats();
    }
}

export function getStats()
{
    return { ...stats };
}

export function recordChest(type)
{
    const key = CHEST_KEYS[type];

    if (!key) return Promise.resolve();

    stats[key] += 1;

    return saveStats();
}

export function recordCombo(amount)
{
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= stats.best_combo) return Promise.resolve();

    stats.best_combo = value;

    return saveStats();
}

// New game
export async function resetStats()
{
    stats = emptyStats();
    await saveStats();
}
