import { fetchDb, putDb } from "./data.js";

const playerMoneyElement = document.querySelector("#player-money");

let gameSession = null;
let money = 0;
let passiveIncome = 0;
let incomeTimer = null;
let saveQueue = Promise.resolve();

function renderMoney()
{
    const formattedMoney = money.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const formattedIncome = passiveIncome.toLocaleString(undefined, { maximumFractionDigits: 2 });
    playerMoneyElement.textContent = `${formattedMoney} $ | +${formattedIncome} $/s`;
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
    passiveIncome = Array.isArray(placements)
        ? placements.reduce((total, placement) => total + (Number(placement.value) || 0), 0)
        : 0;

    const lastSave = Date.parse(session.last_save_at);
    if (Number.isFinite(lastSave))
    {
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - lastSave) / 1000));
        money += passiveIncome * elapsedSeconds;
    }

    renderMoney();

    incomeTimer = setInterval(() =>
    {
        money += passiveIncome;
        renderMoney();
    }, 1000);
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

export async function refreshPassiveIncome()
{
    const placements = await fetchDb("PLACEMENT");
    passiveIncome = Array.isArray(placements)
        ? placements.reduce((total, placement) => total + (Number(placement.value) || 0), 0)
        : 0;
    renderMoney();
}

window.addEventListener("pagehide", () =>
{
    persistMoney(true).catch((error) => console.error("Could not save money: ", error));
});