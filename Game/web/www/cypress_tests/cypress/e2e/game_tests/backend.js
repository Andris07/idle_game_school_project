const clone = (value) => JSON.parse(JSON.stringify(value));

// Cypress (mostly in Firefox) sometimes throws "this.$iframe[0].contentWindow is null" from its own runner code when a
// request of the game is still in flight while the page of the game is being replaced (end of a test, page reopen).
// It is not an error of the game, so it must not fail the test. Every other error still does.
Cypress.on('uncaught:exception', (error) =>
{
    if (String(error?.message).includes('contentWindow is null')) return false;
});

// the numbers of the game itself (game.js / chests.js): the tests use them instead of repeating magic numbers
export const STARTING_MONEY = 100;
export const SHAPE_CHEST_COST = 100;

// "normal (8×8)": the text of a difficulty in the start popup and in the info popup
export const difficultyLabel = ({ name, grid_size }) => `${name} (${grid_size}×${grid_size})`;

export const DIFFICULTIES =
[
    { id: '0', name: 'easy', grid_size: 10 },
    { id: '1', name: 'normal', grid_size: 8 },
    { id: '2', name: 'hard', grid_size: 6 },
];

export const SHAPES =
[
    { id: '0', name: 'i', base_value: 0, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    { id: '1', name: 'o', base_value: 0, cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
    { id: '2', name: 't', base_value: 0, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    { id: '3', name: 's', base_value: 0, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    { id: '4', name: 'z', base_value: 0, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    { id: '5', name: 'j', base_value: 0, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    { id: '6', name: 'l', base_value: 0, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
];

const EVENT_TYPES =
[
    { id: '0', name: 'gold_rush', duration_seconds: 300 },
    { id: '1', name: 'double_shape', duration_seconds: 60 },
    { id: '2', name: 'time_freeze', duration_seconds: 30 },
    { id: '3', name: 'value_burst', duration_seconds: 180 },
];

// the database of a player who has not started a game yet
export function createDb(overrides = {})
{
    return clone({
        DIFFICULTY: DIFFICULTIES,
        EVENT_TYPE: EVENT_TYPES,
        SHAPE: SHAPES,
        GAME_SESSION: { id: '0', difficulty_id: null, money: 0, total_earned: 0, paused_ms: 0, last_save_at: '', started_at: '' },
        GAME_STATS: { id: '0', shape_chests: 0, upgrade_chests: 0, buff_chests: 0, best_combo: 0 },
        GAME_EVENT: { id: '0', event_type_id: null, effect_value: 0, started_at: '', expires_at: '' },
        INVENTORY_ITEM: [],
        PLACEMENT: [],
        ...overrides,
    });
}

// A game that is already in progress (what the database looks like after some playing).
// Every option can be overridden; the result goes to installBackend() as the "overrides" of the database.
export function inProgressGame(options = {})
{
    const {
        difficultyId = '1',
        money = 250,
        totalEarned = 400,
        startedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        stats = { shape_chests: 3, upgrade_chests: 2, buff_chests: 1, best_combo: 500 },
        placements =
        [
            // the "o" shape in the top left corner (4 cells), its value is 0 so the passive income stays 0
            { id: '1', shape_id: '1', value: 0, cells: SHAPES[1].cells, x_coord: 0, y_coord: 0 },
        ],
        inventory =
        [
            { id: '1', shape_id: '0', value: 7, cells: SHAPES[0].cells },
        ],
    } = options;

    return {
        GAME_SESSION:
        {
            id: '0',
            difficulty_id: difficultyId,
            money,
            total_earned: totalEarned,
            paused_ms: 0,
            last_save_at: new Date().toISOString(),
            started_at: startedAt,
        },
        GAME_STATS: { id: '0', ...stats },
        PLACEMENT: placements,
        INVENTORY_ITEM: inventory,
    };
}

// installs the fake json-server and returns its data (the same object the game reads and writes).
// it does what the json-server does for this game: GET (table / id), POST (new id), PUT (table or id), DELETE (id).
export function installBackend(overrides = {})
{
    const db = createDb(overrides);
    let nextId = 1000;

    const headers =
    {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': '*',
    };

    cy.intercept({ url: /^https?:\/\/[^/]+:3000\// }, (req) =>
    {
        const [table, id] = new URL(req.url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
        const reply = (statusCode, body = {}) => req.reply({ statusCode, body, headers });
        const isList = Array.isArray(db[table]);

        if (req.method === 'OPTIONS') return req.reply({ statusCode: 204, body: '', headers });
        if (!(table in db)) return reply(404);

        if (req.method === 'GET')
        {
            if (id === undefined) return reply(200, clone(db[table]));

            const item = isList ? db[table].find((entry) => String(entry.id) === id) : null;
            return item ? reply(200, clone(item)) : reply(404);
        }

        if (req.method === 'POST' && isList)
        {
            const item = { ...req.body, id: String(nextId++) };
            db[table].push(item);
            return reply(201, clone(item));
        }

        if (req.method === 'PUT')
        {
            if (!isList && id === undefined)
            {
                db[table] = clone(req.body);
                return reply(200, req.body);
            }

            const index = isList ? db[table].findIndex((entry) => String(entry.id) === id) : -1;
            if (index < 0) return reply(404);

            db[table][index] = { ...clone(req.body), id: db[table][index].id };
            return reply(200, clone(db[table][index]));
        }

        if (req.method === 'DELETE' && isList)
        {
            db[table] = db[table].filter((entry) => String(entry.id) !== id);
            return reply(200);
        }

        return reply(404);
    });

    return db;
}

// opens the game with the given theme ("dark" is the default of the game too)
export function visitGame(theme = 'dark')
{
    cy.visit('/',
    {
        onBeforeLoad(win)
        {
            win.localStorage.setItem('theme', theme);
        },
    });
}

// closes and opens the page again (what the player does with F5): the data has to come back from the database
export function reopenGame(theme = 'dark')
{
    visitGame(theme);
}

// chooses a difficulty (by its id in the DIFFICULTY table) in the start popup and starts the game
export function startNewGame(difficultyId = '1')
{
    cy.get('#popup-overlay[data-popup="difficulty"]').should('be.visible');
    cy.get('#grid-size-select option').should('have.length.at.least', 1);
    cy.get('#grid-size-select').select(difficultyId);
    cy.get('#start-game-button').click();
    cy.get('#popup-overlay').should('not.exist');
}

// the game saves asynchronously, so a check of the database is retried until it passes (or times out)
export function dbShould(check)
{
    cy.wrap(null, { log: false }).should(() => check());
}

export function cellCount(size)
{
    return size * size;
}

// width of one board cell in pixels
export function cellWidth()
{
    return cy.get('#playgrid .play-cell').first().then(($cell) => $cell[0].getBoundingClientRect().width);
}

// the elements must be inside the screen horizontally (no sideways scrolling needed to see them)
export function expectInsideViewport(selectors)
{
    cy.window().then((win) =>
    {
        selectors.forEach((selector) =>
        {
            cy.get(selector).each(($element) =>
            {
                const rect = $element[0].getBoundingClientRect();

                expect(rect.left, `${selector} left edge`).to.be.at.least(-1);
                expect(rect.right, `${selector} right edge`).to.be.at.most(win.innerWidth + 1);
            });
        });
    });
}
