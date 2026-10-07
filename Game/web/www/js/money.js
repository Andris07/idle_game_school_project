import { fetchDb, putDb } from "./data.js";

const playerMoneyElement = document.querySelector("#player-money");

let gameSession = null;
let money = 0;
let passiveIncome = 0;
let incomeTimer = null;
let lastTickAt = 0;
let saveQueue = Promise.resolve();

function sumPlacementValues(placements)
{
    if (!Array.isArray(placements)) return 0;

    return placements.reduce((total, placement) => total + (Number(placement.value) || 0), 0);
}

function renderMoney()
{
    const formattedMoney = money.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const formattedIncome = passiveIncome.toLocaleString(undefined, { maximumFractionDigits: 2 });
    playerMoneyElement.textContent = `${formattedMoney} $ | +${formattedIncome} $/s`;
}

// money is accrued every second, but we also need to account for the time elapsed since the last tick when the page was hidden or the user switched tabs
function accrueIncome()
{
    if (incomeTimer === null) return;

    const seconds = Math.floor((Date.now() - lastTickAt) / 1000);
    if (seconds <= 0) return;

    lastTickAt += seconds * 1000;
    money += passiveIncome * seconds;
    renderMoney();
}

function persistMoney(keepalive = false)
{
    if (!gameSession) return Promise.resolve();

    gameSession =
    {
        ...gameSession,
        money,
        last_save_at: new Date().toISOString(),
    };

    const sessionToSave = { ...gameSession };

    if (keepalive)
    {
        return putDb("GAME_SESSION", sessionToSave, { keepalive: true });
    }

    saveQueue = saveQueue
        .catch((error) => console.error("Could not save money: ", error))
        .then(() => putDb("GAME_SESSION", sessionToSave));

    return saveQueue;
}

// before new game session is created, we need to wait for any pending money saves to finish, otherwise the new session might overwrite the old one
export async function waitForPendingSaves()
{
    try
    {
        await saveQueue;
    }
    catch (error)
    {
        console.error("Pending money save failed: ", error);
    }
}

export function stopMoneySystem()
{
    if (incomeTimer !== null)
    {
        clearInterval(incomeTimer);
        incomeTimer = null;
    }

    gameSession = null;
    money = 0;
    passiveIncome = 0;
    renderMoney();
}

export async function startMoneySystem()
{
    stopMoneySystem();

    const [session, placements] = await Promise.all([
        fetchDb("GAME_SESSION"),
        fetchDb("PLACEMENT"),
    ]);

    if (!session || session.difficulty_id == null) return;

    gameSession = session;
    money = Math.max(0, Number(session.money) || 0);
    passiveIncome = sumPlacementValues(placements);

    const lastSave = Date.parse(session.last_save_at);
    if (Number.isFinite(lastSave))
    {
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - lastSave) / 1000));
        money += passiveIncome * elapsedSeconds;
    }

    renderMoney();

    lastTickAt = Date.now();
    incomeTimer = setInterval(accrueIncome, 1000);
}

export async function addMoney(amount)
{
    const value = Number(amount);
    if (!gameSession || !Number.isFinite(value)) return;

    money = Math.max(0, money + value);
    renderMoney();
    await persistMoney();
}

export async function spendMoney(amount)
{
    const cost = Number(amount);
    if (!gameSession || !Number.isFinite(cost) || cost <= 0 || money < cost) return false;

    money -= cost;
    renderMoney();

    try
    {
        await persistMoney();
        return true;
    }
    catch (error)
    {
        money += cost;
        renderMoney();
        throw error;
    }
}

// recalculates passive income based on the current placements and updates the display
export function updatePassiveIncome(placements)
{
    accrueIncome();
    passiveIncome = sumPlacementValues(placements);
    renderMoney();
}

function saveOnLeave()
{
    persistMoney(true).catch((error) => console.error("Could not save money: ", error));
}

window.addEventListener("pagehide", saveOnLeave);

document.addEventListener("visibilitychange", () =>
{
    if (document.visibilityState === "hidden") saveOnLeave();
});
