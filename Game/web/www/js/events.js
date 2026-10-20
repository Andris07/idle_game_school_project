import { fetchDb, putDb } from "./data.js";
import { setIncomeBoost } from "./money.js";

// Quick time events (opened from the Buff Chest).
//
// Only one event can be active at a time. The chosen event is stored in the GAME_EVENT table (it is not saved to the inventory),
// and it starts when the player closes the popup of the chest. The duration comes from the EVENT_TYPE table.
//
// This file contains what every event does:
//   gold_rush    -> the passive income is multiplied (money.js applies it through setIncomeBoost)
//   double_shape -> every opened shape gets an identical copy (chests.js asks for it with getShapeCopies)
//   time_freeze  -> completed rows/columns are not cleared until the freeze ends (placement.js asks for it with isGridFrozen)
//   value_burst  -> row/column completion rewards are multiplied (placement.js asks for it with getLineRewardMultiplier)

const TICK_MS = 250;
const IDLE_TIMER_TEXT = "--:--";

export const EVENT_DEFINITIONS =
{
    gold_rush:
    {
        title: "Gold Rush",
        icon: "./src/gold_rush.png",
        description: "All passive income is doubled (x2).",
        effect: "income_multiplier",
        effectValue: 2,
    },
    double_shape:
    {
        title: "Double Shape",
        icon: "./src/double_shape.png",
        description: "Every shape you open also gives you an identical copy.",
        effect: "shape_copies",
        effectValue: 2,
    },
    time_freeze:
    {
        title: "Time Freeze",
        icon: "./src/time_freeze.png",
        description: "Completed rows and columns stay on the board and are paid out together as one combo when the freeze ends.",
        effect: "grid_freeze",
        effectValue: 1, // no number is needed here, the effect is the freeze itself
    },
    value_burst:
    {
        title: "Value Burst",
        icon: "./src/value_burst.png",
        description: "All row and column completion rewards are increased by 50%.",
        effect: "line_reward_multiplier",
        effectValue: 1.5,
    },
};

const timerElement = document.querySelector("#game-timer");
const iconElement = document.querySelector("#event-icon");

let active = null;          // the running event: { name, typeId, definition, startedAt, expiresAt }
let pending = null;         // opened from the chest, but the popup is still open, so it has not started yet
let expiredOnLoad = null;   // an event that ran out while the page was closed, it is settled once the board is loaded
let finishing = false;
let pausedAt = null;        // set while the game is paused (info popup): the time of the running event stands still
let tickTimer = null;
let saveQueue = Promise.resolve();

const endListeners = new Set();
const changeListeners = new Set();

/* ---------- database ---------- */

function emptyEventRecord()
{
    return { id: "0", event_type_id: null, effect_value: 0, started_at: "", expires_at: "" };
}

function toRecord(typeId, definition, startedAt, expiresAt)
{
    return {
        id: "0",
        event_type_id: typeId,
        effect_value: definition.effectValue,
        started_at: startedAt === null ? "" : new Date(startedAt).toISOString(),
        expires_at: expiresAt === null ? "" : new Date(expiresAt).toISOString(),
    };
}

// GAME_EVENT is a single record, so writes are queued to keep their order (a late "empty" save must not overwrite a newer event)
function saveEventRecord(record)
{
    saveQueue = saveQueue
        .catch((error) => console.error("Could not save event: ", error))
        .then(() => putDb("GAME_EVENT", record));

    return saveQueue;
}

function isIdleRecord(record)
{
    return !record
        || record.event_type_id == null
        || record.event_type_id === ""
        || !(Number(record.effect_value) > 0);
}

// event types of the database that this file knows how to run
export async function loadEventTypes()
{
    const types = await fetchDb("EVENT_TYPE");

    return types.filter((type) => EVENT_DEFINITIONS[type.name] && Number(type.duration_seconds) > 0);
}

function now()
{
    return pausedAt ?? Date.now();
}

export function pauseEvents()
{
    if (pausedAt !== null) return;

    pausedAt = Date.now();
}

export function resumeEvents()
{
    if (pausedAt === null) return;

    const delta = Date.now() - pausedAt;

    pausedAt = null;

    if (!active || delta <= 0) return;

    active.startedAt += delta;
    active.expiresAt += delta;
    renderTimer();

    saveEventRecord(toRecord(active.typeId, active.definition, active.startedAt, active.expiresAt))
        .catch((error) => console.error("Could not save the resumed event: ", error));
}

/* ---------- display (icon + remaining time in the menu) ---------- */

function formatTimer(totalSeconds)
{
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatEventDuration(totalSeconds)
{
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) return `${seconds} sec`;
    if (seconds === 0) return `${minutes} min`;

    return `${minutes} min ${seconds} sec`;
}

function renderTimer()
{
    if (!active)
    {
        timerElement.textContent = IDLE_TIMER_TEXT;
        return;
    }

    const remainingSeconds = Math.max(0, Math.ceil((active.expiresAt - now()) / 1000));
    const text = formatTimer(remainingSeconds);

    // the timer ticks more often than once a second, so the DOM is only touched when the text changes
    if (timerElement.textContent !== text) timerElement.textContent = text;
}

function renderEventState()
{
    if (!active)
    {
        iconElement.hidden = true;
        iconElement.removeAttribute("src");
        iconElement.alt = "";
        iconElement.title = "";
        timerElement.removeAttribute("title");
        timerElement.classList.remove("is-running");
        delete document.body.dataset.event;
        renderTimer();
        return;
    }

    iconElement.src = active.definition.icon;
    iconElement.alt = active.definition.title;
    iconElement.title = `${active.definition.title}: ${active.definition.description}`;
    iconElement.hidden = false;
    timerElement.title = iconElement.title;
    timerElement.classList.add("is-running");
    document.body.dataset.event = active.name; // CSS can style the page for the running event
    renderTimer();
}

/* ---------- lifecycle ---------- */

function notifyChange()
{
    changeListeners.forEach((listener) =>
    {
        try
        {
            listener();
        }
        catch (error)
        {
            console.error("Event change listener failed: ", error);
        }
    });
}

async function notifyEnd(finished)
{
    const results = await Promise.allSettled([...endListeners].map((listener) => listener(finished)));

    results.forEach((result) =>
    {
        if (result.status === "rejected") console.error("Event end listener failed: ", result.reason);
    });
}

function stopTicking()
{
    if (tickTimer !== null)
    {
        clearInterval(tickTimer);
        tickTimer = null;
    }
}

function beginEvent(info)
{
    active = info;

    if (info.definition.effect === "income_multiplier")
    {
        setIncomeBoost({
            multiplier: info.definition.effectValue,
            startsAt: info.startedAt,
            endsAt: info.expiresAt,
        });
    }

    renderEventState();

    stopTicking();
    tickTimer = setInterval(tick, TICK_MS);

    notifyChange();
}

function tick()
{
    if (!active || pausedAt !== null) return;

    if (now() >= active.expiresAt)
    {
        finishActiveEvent();
        return;
    }

    renderTimer();
}

async function finishActiveEvent()
{
    if (!active || finishing) return;

    finishing = true;
    const finished = active;

    try
    {
        stopTicking();
        active = null;

        if (finished.definition.effect === "income_multiplier") setIncomeBoost(null);

        renderEventState();
        notifyChange();

        try
        {
            await saveEventRecord(emptyEventRecord());
        }
        catch (error)
        {
            console.error("Could not clear the finished event: ", error);
        }

        // the effect is over at this point (isGridFrozen() is false), so listeners can settle what the event was holding back
        await notifyEnd(finished);
    }
    finally
    {
        finishing = false;
    }
}

/* ---------- used by the Buff Chest ---------- */

// The chest opened an event: it is stored right away, but it only starts when startPendingEvent() is called (popup closed).
// Returns the definition of the event for the popup.
export async function queueEvent(type)
{
    const definition = EVENT_DEFINITIONS[type?.name];

    if (!definition) throw new Error(`Unknown event type: ${type?.name}`);
    if (active || pending) throw new Error("A quick time event is already running");

    pending = { type, definition };
    notifyChange();

    try
    {
        // started_at / expires_at stay empty until the popup is closed, the record is only there so the paid event is not lost on reload
        await saveEventRecord(toRecord(type.id, definition, null, null));
    }
    catch (error)
    {
        pending = null;
        notifyChange();
        throw error;
    }

    return definition;
}

// The popup was closed, the timer starts now.
export async function startPendingEvent()
{
    if (!pending) return;

    const { type, definition } = pending;
    pending = null;

    const startedAt = Date.now();
    const expiresAt = startedAt + Number(type.duration_seconds) * 1000;

    beginEvent({ name: type.name, typeId: type.id, definition, startedAt, expiresAt });

    try
    {
        await saveEventRecord(toRecord(type.id, definition, startedAt, expiresAt));
    }
    catch (error)
    {
        // the event still runs in this tab, only a reload could lose it
        console.error("Could not save the started event: ", error);
    }
}

/* ---------- state for the rest of the game ---------- */

// true while a chest event is opened or running (the Buff Chest is locked during this time)
export function isEventBusy()
{
    return active !== null || pending !== null;
}

export function getActiveEvent()
{
    return active ? { name: active.name, startedAt: active.startedAt, expiresAt: active.expiresAt } : null;
}

// value of the running event's effect, or the fallback if the running event has a different effect
function getEffect(effect, fallback)
{
    if (!active || now() >= active.expiresAt) return fallback;

    return active.definition.effect === effect ? active.definition.effectValue : fallback;
}

export function getLineRewardMultiplier()
{
    return getEffect("line_reward_multiplier", 1);
}

export function getShapeCopies()
{
    return getEffect("shape_copies", 1);
}

export function isGridFrozen()
{
    return getEffect("grid_freeze", 0) > 0;
}

// listener(finishedEvent) is called after an event ran out, finishedEvent.name tells which one
export function onEventEnd(listener)
{
    endListeners.add(listener);
}

export function onEventChange(listener)
{
    changeListeners.add(listener);
}

/* ---------- save / load / restart ---------- */

// Loads the event of the saved game. Call it BEFORE the money system starts, because the offline income needs to know about a Gold Rush.
export async function restoreEvent()
{
    let record;
    let types;

    try
    {
        [record, types] = await Promise.all([fetchDb("GAME_EVENT"), fetchDb("EVENT_TYPE")]);
    }
    catch (error)
    {
        console.error("Could not load the event: ", error);
        return;
    }

    if (isIdleRecord(record)) return;

    const type = types.find((candidate) => String(candidate.id) === String(record.event_type_id));
    const definition = type && EVENT_DEFINITIONS[type.name];

    if (!definition)
    {
        await saveEventRecord(emptyEventRecord()).catch((error) => console.error("Could not clear the event: ", error));
        return;
    }

    const startedAt = Date.parse(record.started_at);
    const expiresAt = Date.parse(record.expires_at);
    const durationMs = Number(type.duration_seconds) * 1000;

    // opened, but the page was closed before the popup was closed: the event starts now
    if (!Number.isFinite(startedAt) || !Number.isFinite(expiresAt))
    {
        const now = Date.now();

        beginEvent({ name: type.name, typeId: type.id, definition, startedAt: now, expiresAt: now + durationMs });
        saveEventRecord(toRecord(type.id, definition, now, now + durationMs))
            .catch((error) => console.error("Could not save the started event: ", error));
        return;
    }

    const info = { name: type.name, typeId: type.id, definition, startedAt, expiresAt };

    if (expiresAt > Date.now())
    {
        beginEvent(info);
        return;
    }

    // it ran out while the page was closed, it is settled by settleExpiredEvent() when the board is ready
    expiredOnLoad = info;

    if (definition.effect === "income_multiplier")
    {
        setIncomeBoost({ multiplier: definition.effectValue, startsAt, endsAt: expiresAt });
    }
}

// Call it after the board is loaded: finishes an event that ran out while the page was closed (a Time Freeze still has rows to pay out).
export async function settleExpiredEvent()
{
    if (!expiredOnLoad) return;

    const finished = expiredOnLoad;
    expiredOnLoad = null;

    if (finished.definition.effect === "income_multiplier") setIncomeBoost(null);

    try
    {
        await saveEventRecord(emptyEventRecord());
    }
    catch (error)
    {
        console.error("Could not clear the finished event: ", error);
    }

    await notifyEnd(finished);
}

// New game: everything about the events is thrown away, the end listeners are NOT called
export async function resetEvents()
{
    stopTicking();

    active = null;
    pending = null;
    expiredOnLoad = null;
    finishing = false;
    pausedAt = null;

    setIncomeBoost(null);
    renderEventState();
    notifyChange();

    await saveEventRecord(emptyEventRecord());
}
