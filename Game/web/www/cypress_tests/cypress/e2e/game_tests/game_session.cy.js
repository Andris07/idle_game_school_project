import
{
    DIFFICULTIES, SHAPE_CHEST_COST, STARTING_MONEY,
    dbShould, difficultyLabel, inProgressGame, installBackend, reopenGame, startNewGame, visitGame,
}
from './backend';

// the tests wait for a real browser and a real page: one failed attempt because of the browser is not a failed test
const STABLE = { retries: { runMode: 2, openMode: 2 } };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const byName = (name) => DIFFICULTIES.find((difficulty) => difficulty.name === name);
const EASY = byName('easy');
const NORMAL = byName('normal');
const HARD = byName('hard');
const cells = ({ grid_size }) => grid_size * grid_size;

// the saved game that is loaded from the database in the tests of "loading" and "new game"
const SEED = { money: 250, totalEarned: 400, stats: { shape_chests: 3, upgrade_chests: 2, buff_chests: 1, best_combo: 500 } };
const seedGame = (options = {}) => inProgressGame({ difficultyId: NORMAL.id, money: SEED.money, totalEarned: SEED.totalEarned, stats: SEED.stats, ...options });

const moneyText = (amount) => new RegExp(`^${amount} \\$`);

describe('Session: start of the game', STABLE, () =>
{
    beforeEach(() =>
    {
        cy.viewport(1280, 720);
    });

    it('has no start time before a game is started', () =>
    {
        const db = installBackend();
        visitGame();

        cy.get('#popup-overlay[data-popup="difficulty"]').should('be.visible');
        cy.get('#grid-size-select option').should('have.length', DIFFICULTIES.length);

        dbShould(() =>
        {
            expect(db.GAME_SESSION.difficulty_id).to.equal(null);
            expect(db.GAME_SESSION.started_at).to.equal('');
        });
    });

    it('saves the start time (started_at), the difficulty and the starting money', () =>
    {
        const db = installBackend();
        let clickedAt = 0;

        visitGame();
        cy.get('#grid-size-select option').should('have.length', DIFFICULTIES.length);
        cy.get('#grid-size-select').select(HARD.id);
        cy.then(() => { clickedAt = Date.now(); });
        cy.get('#start-game-button').click();

        dbShould(() =>
        {
            expect(db.GAME_SESSION.difficulty_id).to.equal(HARD.id);
            expect(db.GAME_SESSION.started_at).to.match(ISO_DATE);

            const startedAt = Date.parse(db.GAME_SESSION.started_at);

            expect(startedAt, 'not before the click').to.be.at.least(clickedAt - 1000);
            expect(startedAt, 'not in the future').to.be.at.most(Date.now() + 1000);
            expect(db.GAME_SESSION.money).to.equal(STARTING_MONEY);
        });

        cy.get('#playgrid .play-cell').should('have.length', cells(HARD));
        cy.get('#popup-overlay').should('not.exist');
    });

    it('keeps the start time when the game saves again and when the page is opened again', () =>
    {
        const db = installBackend();
        let startedAt = '';

        visitGame();
        startNewGame(NORMAL.id);
        dbShould(() => { expect(db.GAME_SESSION.started_at).to.match(ISO_DATE); });
        cy.then(() => { startedAt = db.GAME_SESSION.started_at; });

        // buying a chest saves the session again (the money changes)
        cy.get('#shape-chest-button').click();
        cy.get('#inventory .inventory-item').should('have.length', 1);
        dbShould(() => { expect(db.GAME_SESSION.money).to.equal(STARTING_MONEY - SHAPE_CHEST_COST); });

        reopenGame();
        cy.get('#playgrid .play-cell').should('have.length', cells(NORMAL));

        cy.then(() =>
        {
            expect(db.GAME_SESSION.started_at).to.equal(startedAt);
        });
    });
});

describe('Session: loading the saved game', STABLE, () =>
{
    beforeEach(() =>
    {
        cy.viewport(1280, 720);
    });

    it('loads the saved game on open: no start popup, same board, inventory and money', () =>
    {
        const game = seedGame();
        installBackend(game);
        visitGame();

        cy.get('#playgrid .play-cell').should('have.length', cells(NORMAL));
        cy.get('#popup-overlay').should('not.exist');

        const filledCells = game.PLACEMENT.reduce((sum, placement) => sum + placement.cells.length, 0);
        cy.get('#playgrid .play-cell-filled').should('have.length', filledCells);
        cy.get('#inventory .inventory-item').should('have.length', game.INVENTORY_ITEM.length);
        cy.get('#inventory .inventory-item').first().should('contain.text', `${game.INVENTORY_ITEM[0].value}$`);
        cy.get('#player-money').invoke('text').should('match', moneyText(SEED.money));
    });

    it('keeps the data after the page is opened again instead of deleting it', () =>
    {
        const db = installBackend();

        visitGame();
        startNewGame(HARD.id);
        cy.get('#playgrid .play-cell').should('have.length', cells(HARD));

        // the shape chest costs everything we have at the start
        cy.get('#shape-chest-button').click();
        cy.get('#inventory .inventory-item').should('have.length', 1);
        cy.get('#player-money').invoke('text').should('match', moneyText(STARTING_MONEY - SHAPE_CHEST_COST));
        dbShould(() =>
        {
            expect(db.INVENTORY_ITEM).to.have.length(1);
            expect(db.GAME_STATS.shape_chests).to.equal(1);
        });

        reopenGame();

        // nothing is asked or deleted: the same game comes back after reload
        cy.get('#playgrid .play-cell').should('have.length', cells(HARD));
        cy.get('#popup-overlay').should('not.exist');
        cy.get('#inventory .inventory-item').should('have.length', 1);
        cy.get('#player-money').invoke('text').should('match', moneyText(STARTING_MONEY - SHAPE_CHEST_COST));
        cy.then(() =>
        {
            expect(db.GAME_SESSION.difficulty_id).to.equal(HARD.id);
            expect(db.INVENTORY_ITEM).to.have.length(1);
        });
    });
});

describe('Session: info popup', STABLE, () =>
{
    beforeEach(() =>
    {
        cy.viewport(1280, 720);
        installBackend(seedGame());
        visitGame();
        cy.get('#playgrid .play-cell').should('have.length', cells(NORMAL));
    });

    it('opens from the info icon at any time and shows the saved data of the game', () =>
    {
        cy.get('#info-button').click();

        cy.get('#popup-overlay[data-popup="stats"]').should('be.visible');
        cy.get('#popup-window h2').should('have.text', 'Game info');
        cy.contains('.stats-row', 'Difficulty').find('dd').should('have.text', difficultyLabel(NORMAL));
        cy.contains('.stats-row', 'Started').find('dd').invoke('text').should('match', /\d/);
        cy.contains('.stats-row', 'Time played').find('dd').invoke('text').should('match', /^\d+m \d{2}s$/);

        const { shape_chests, upgrade_chests, buff_chests, best_combo } = SEED.stats;

        cy.get('.stats-chest-count').then(($counts) =>
        {
            expect([...$counts].map((count) => count.textContent)).to.deep.equal([shape_chests, upgrade_chests, buff_chests].map(String));
        });
        cy.get('.stats-total').should('have.text', `Total: ${shape_chests + upgrade_chests + buff_chests}`);
        cy.get('.stats-row-money dd').invoke('text').should('match', moneyText(SEED.totalEarned));
        cy.get('.stats-row-combo dd').invoke('text').should('match', moneyText(best_combo));
    });

    it('shows the same data after the page is opened again', () =>
    {
        reopenGame();
        cy.get('#playgrid .play-cell').should('have.length', cells(NORMAL));

        cy.get('#info-button').click();
        cy.contains('.stats-row', 'Difficulty').find('dd').should('have.text', difficultyLabel(NORMAL));
        cy.get('.stats-total').should('have.text', `Total: ${SEED.stats.shape_chests + SEED.stats.upgrade_chests + SEED.stats.buff_chests}`);
    });

    it('closes with the "continue game" button and the game goes on', () =>
    {
        cy.get('#info-button').click();
        cy.get('#popup-close-button').should('have.text', 'continue game').click();

        cy.get('#popup-overlay').should('not.exist');
        cy.get('#playgrid .play-cell').should('have.length', cells(NORMAL));
    });
});

describe('Session: new game', STABLE, () =>
{
    const OLD_START = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let db;

    beforeEach(() =>
    {
        cy.viewport(1280, 720);

        const game = seedGame({ startedAt: OLD_START });

        db = installBackend({
            ...game,
            SHAPE:
            [
                { id: '0', name: 'i', base_value: 30, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
                { id: '1', name: 'o', base_value: 12, cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
            ],
        });

        visitGame();
        cy.get('#playgrid .play-cell').should('have.length', cells(NORMAL));
        cy.get('#new-game-button').should('be.visible');
    });

    it('deletes the old data when a new game is started', () =>
    {
        cy.get('#new-game-button').click();

        // the start popup is back, the old board and inventory are gone
        cy.get('#popup-overlay[data-popup="difficulty"]').should('exist');
        cy.get('#playgrid .play-cell').should('not.exist');
        cy.get('#inventory .inventory-item').should('not.exist');

        // rest of the database are restored to default starting values
        dbShould(() =>
        {
            expect(db.GAME_SESSION.difficulty_id, 'difficulty').to.equal(null);
            expect(db.GAME_SESSION.money, 'money').to.equal(0);
            expect(db.GAME_SESSION.total_earned, 'total earned').to.equal(0);
            expect(db.GAME_SESSION.started_at, 'start time').to.equal('');
            expect(db.INVENTORY_ITEM, 'inventory').to.have.length(0);
            expect(db.PLACEMENT, 'placements').to.have.length(0);
            expect(db.GAME_STATS, 'statistics').to.deep.equal({ id: '0', shape_chests: 0, upgrade_chests: 0, buff_chests: 0, best_combo: 0 });
            expect(db.SHAPE.every((shape) => shape.base_value === 0), 'upgrades').to.equal(true);
            expect(db.GAME_EVENT.event_type_id, 'event').to.equal(null);
        });

        cy.get('#player-money').invoke('text').should('match', moneyText(0));
    });

    it('starts a new session with a new start time and clean statistics', () =>
    {
        let clickedAt = 0;

        cy.get('#new-game-button').click();
        dbShould(() => { expect(db.GAME_SESSION.difficulty_id).to.equal(null); });

        cy.then(() => { clickedAt = Date.now(); });
        startNewGame(EASY.id);
        // a different difficulty than the old game had

        cy.get('#playgrid .play-cell').should('have.length', cells(EASY));
        cy.get('#playgrid .play-cell-filled').should('not.exist');
        cy.get('#inventory .inventory-item').should('not.exist');
        cy.get('#player-money').invoke('text').should('match', moneyText(STARTING_MONEY));

        dbShould(() =>
        {
            expect(db.GAME_SESSION.difficulty_id).to.equal(EASY.id);
            expect(db.GAME_SESSION.money).to.equal(STARTING_MONEY);
            expect(db.GAME_SESSION.started_at, 'new start time').to.not.equal(OLD_START);
            expect(Date.parse(db.GAME_SESSION.started_at)).to.be.at.least(clickedAt - 1000);
        });

        // the info popup of the new game shows nothing from the old one
        cy.get('#info-button').click();
        cy.contains('.stats-row', 'Difficulty').find('dd').should('have.text', difficultyLabel(EASY));
        cy.get('.stats-chest-count').then(($counts) =>
        {
            expect([...$counts].map((count) => count.textContent)).to.deep.equal(['0', '0', '0']);
        });
        cy.get('.stats-total').should('have.text', 'Total: 0');
        cy.get('.stats-row-money dd').invoke('text').should('match', moneyText(0));
        cy.get('.stats-row-combo dd').should('have.text', '-');
    });

    it('does not bring the old game back when the page is opened again', () =>
    {
        cy.get('#new-game-button').click();
        dbShould(() => { expect(db.GAME_SESSION.difficulty_id).to.equal(null); });

        reopenGame();

        cy.get('#popup-overlay[data-popup="difficulty"]').should('exist');
        cy.get('#playgrid .play-cell').should('not.exist');
    });
});
