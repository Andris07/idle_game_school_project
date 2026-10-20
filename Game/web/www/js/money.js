import { fetchDb, putDb, setAfterWrite } from "./data.js";

const playerMoneyElement = document.querySelector("#player-money");
const lineRewardPopup = document.querySelector("#line-reward-popup");

let gameSession = null;
let money = 0;
let passiveIncome = 0;
let incomeTimer = null;
let lastTickAt = 0;
let saveQueue = Promise.resolve();
let incomeBoost = null; // { multiplier, startsAt, endsAt } while an event (Gold Rush) changes the passive income
let lineRewardAnimation = null;

function sumPlacementValues(placements)
{
    if (!Array.isArray(placements)) return 0;

    return placements.reduce((total, placement) => total + (Number(placement.value) || 0), 0);
}

export function formatMoney(value)
{
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// how many seconds of the boost fall between the two timestamps (the boost has its own start and end)
function getBoostedSeconds(fromMs, toMs)
{
    if (!incomeBoost) return 0;

    const start = Math.max(fromMs, incomeBoost.startsAt);
    const end = Math.min(toMs, incomeBoost.endsAt);

    return Math.max(0, end - start) / 1000;
}

// the income of a time range, the boost only counts for the part of the range that is inside the event
function earnedBetween(fromMs, toMs)
{
    const seconds = Math.max(0, toMs - fromMs) / 1000;
    const boostedSeconds = getBoostedSeconds(fromMs, toMs);
    const multiplier = incomeBoost ? incomeBoost.multiplier : 1;

    return passiveIncome * seconds + passiveIncome * (multiplier - 1) * boostedSeconds;
}

// the income per second that is really paid right now
function getCurrentIncome()
{
    const now = Date.now();
    const boosted = incomeBoost && now >= incomeBoost.startsAt && now < incomeBoost.endsAt;

    return passiveIncome * (boosted ? incomeBoost.multiplier : 1);
}

function renderMoney()
{
    playerMoneyElement.textContent = `${formatMoney(money)} $ | +${formatMoney(getCurrentIncome())} $/s`;
}

export function getMoney()
{
    return money;
}

export function getGameSession()
{
    return gameSession;
}

export function showLineReward(amount)
{
    const reward = Number(amount);
    if (!Number.isFinite(reward) || reward <= 0) return;

    lineRewardPopup.textContent = `+${formatMoney(reward)} $`;
    lineRewardPopup.hidden = false;
    lineRewardAnimation?.cancel();
    lineRewardAnimation = lineRewardPopup.animate(
        [
            { opacity: 0, transform: "translateY(-35%) scale(0.9)" },
            { opacity: 1, transform: "translateY(-50%) scale(1)", offset: 0.15 },
            { opacity: 1, transform: "translateY(-50%) scale(1)", offset: 0.75 },
            { opacity: 0, transform: "translateY(-75%) scale(1.05)" },
        ],
        { duration: 1800, easing: "ease-out" }
    );

    lineRewardAnimation.onfinish = () =>
    {
        lineRewardPopup.hidden = true;
        lineRewardAnimation = null;
    };
}

// Used by events.js (Gold Rush). Everything earned so far is settled with the old boost first, then the new one is applied.
// The boost can also be set before the money system starts, so the offline income of a running event is counted.
export function setIncomeBoost(boost)
{
    accrueIncome();
    incomeBoost = boost ?? null;
    renderMoney();
}

// money is accrued every second, but we also need to account for the time elapsed since the last tick when the page was hidden or the user switched tabs
function accrueIncome()
{
    if (incomeTimer === null) return;

    const seconds = Math.floor((Date.now() - lastTickAt) / 1000);
    if (seconds <= 0) return;

    const from = lastTickAt;
    lastTickAt += seconds * 1000;
    money += earnedBetween(from, lastTickAt);
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

setAfterWrite(async () =>
{
    if (!gameSession) return;

    accrueIncome();
    await persistMoney();
});

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

    // the boost is not touched here, it belongs to the running event (events.js clears it)
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
        money += earnedBetween(lastSave, lastSave + elapsedSeconds * 1000);
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
