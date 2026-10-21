import { DIFFICULTIES, SHAPES, SHAPE_CHEST_COST, difficultyLabel, inProgressGame, installBackend, visitGame } from './backend';

const HARD = DIFFICULTIES.find((difficulty) => difficulty.name === 'hard');
const SIZE = HARD.grid_size;
const ONE_HOUR_AGO = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

// a chessboard pattern
// and every row and column has free cells (no completed line).
// "freeCells" frees some more cells ([column, row]).
function chessboard(freeCells = [])
{
    const isFree = (column, row) => (column + row) % 2 === 1 || freeCells.some(([c, r]) => c === column && r === row);
    const placements = [];

    for (let row = 0; row < SIZE; row += 1)
    {
        for (let column = 0; column < SIZE; column += 1)
        {
            if (isFree(column, row)) continue;

            // single-cell placements with value 0, so the passive income stays 0
            placements.push({ id: String(placements.length + 1), shape_id: '1', value: 0, cells: [[0, 0]], x_coord: column, y_coord: row });
        }
    }

    // no row and no column may be completed
    const taken = new Set(placements.map(({ x_coord, y_coord }) => `${x_coord},${y_coord}`));

    for (let line = 0; line < SIZE; line += 1)
    {
        const rowFull = Array.from({ length: SIZE }, (_, column) => taken.has(`${column},${line}`)).every(Boolean);
        const columnFull = Array.from({ length: SIZE }, (_, row) => taken.has(`${line},${row}`)).every(Boolean);

        if (rowFull || columnFull) throw new Error(`The test board has a completed line (${rowFull ? 'row' : 'column'} ${line})`);
    }

    return placements;
}

// the inventory holds 8 shapes at most: 7 are there, the 8th comes from the shape chest, which is when the game over is checked
function sevenShapes()
{
    return SHAPES.map((shape) => ({ id: String(Number(shape.id) + 1), shape_id: shape.id, value: 5, cells: shape.cells }));
}

function openGame(freeCells = [])
{
    const db = installBackend(inProgressGame({
        difficultyId: HARD.id,
        money: SHAPE_CHEST_COST,
        totalEarned: SHAPE_CHEST_COST,
        startedAt: ONE_HOUR_AGO(),
        stats: { shape_chests: 0, upgrade_chests: 0, buff_chests: 0, best_combo: 0 },
        placements: chessboard(freeCells),
        inventory: sevenShapes(),
    }));

    visitGame();
    cy.get('#playgrid .play-cell').should('have.length', SIZE * SIZE);
    cy.get('#inventory .inventory-item').should('have.length', SHAPES.length);

    return db;
}

describe('Game over', () =>
{
    beforeEach(() =>
    {
        cy.viewport(1280, 720);
    });

    describe('when nothing can be placed anymore', () =>
    {
        let db;

        beforeEach(() =>
        {
            db = openGame();
            cy.get('#shape-chest-button').click();
            cy.get('#inventory .inventory-item').should('have.length', SHAPES.length + 1);
        });

        it('opens the "Game over" popup in the error style', () =>
        {
            cy.get('#popup-overlay').should('be.visible');
            cy.get('#popup-window h2').should('have.text', 'Game over');
            cy.get('#popup-window').should('have.class', 'popup-window-error');
            cy.get('#popup-window .popup-message').first().should('have.text', 'None of your shapes can be placed anymore.');
            cy.get('#popup-close-button').should('have.text', 'ok');

            // the error color is the --invalid variable of the theme
            cy.document().then((doc) =>
            {
                const invalid = doc.defaultView.getComputedStyle(doc.documentElement).getPropertyValue('--invalid').trim();

                cy.get('#popup-window').then(($popup) =>
                {
                    const probe = doc.createElement('div');
                    probe.style.color = invalid;
                    doc.body.appendChild(probe);
                    const expected = doc.defaultView.getComputedStyle(probe).color;
                    probe.remove();

                    expect($popup.css('border-top-color')).to.equal(expected);
                });
            });
        });

        it('can only be closed with the button (Escape and a click outside do nothing)', () =>
        {
            cy.get('#popup-window h2').should('have.text', 'Game over');

            cy.get('body').type('{esc}');
            cy.get('#popup-window h2').should('have.text', 'Game over');

            cy.get('#popup-overlay').click('topLeft');
            cy.get('#popup-window h2').should('have.text', 'Game over');
        });

        it('shows the result of the game after "ok"', () =>
        {
            cy.get('#popup-close-button').click();

            cy.get('#popup-window h2').should('have.text', 'Your result');
            cy.get('#popup-window').should('not.have.class', 'popup-window-error');

            cy.get('.popup-row').should('have.length', 3);
            cy.contains('.popup-row', 'Difficulty').find('dd').should('have.text', difficultyLabel(HARD));
            // the shape chest took all the money
            cy.contains('.popup-row', 'Money').find('dd').should('have.text', '0 $');
            // the game started an hour ago (started_at)
            cy.contains('.popup-row', 'Time played').find('dd').invoke('text').should('match', /^1h 00m \d{2}s$/);
            cy.get('#popup-close-button').should('have.text', 'new game');
        });

        it('cannot skip the result window either', () =>
        {
            cy.get('#popup-close-button').click();
            cy.get('#popup-window h2').should('have.text', 'Your result');

            cy.get('body').type('{esc}');
            cy.get('#popup-window h2').should('have.text', 'Your result');
        });

        it('starts a new game with "new game": the start popup opens and the old game is deleted', () =>
        {
            cy.get('#popup-close-button').click();
            cy.get('#popup-close-button').should('have.text', 'new game').click();

            cy.get('#popup-overlay[data-popup="difficulty"]').should('exist');
            cy.get('#popup-window h2').should('have.text', 'choose difficulty');
            cy.get('#playgrid .play-cell').should('not.exist');
            cy.get('#inventory .inventory-item').should('not.exist');

            cy.wrap(null).should(() =>
            {
                expect(db.GAME_SESSION.difficulty_id).to.equal(null);
                expect(db.INVENTORY_ITEM).to.have.length(0);
                expect(db.PLACEMENT).to.have.length(0);
            });
        });
    });

    describe('when the game can still go on', () =>
    {
        it('does not end the game while the inventory is not full', () =>
        {
            openGame();
            // 7 shapes, nothing fits, but the player can still open one more chest

            cy.get('#popup-overlay').should('not.exist');
            cy.get('#inventory .inventory-item').should('have.length', SHAPES.length);
        });

        it('does not end the game while a shape still fits somewhere', () =>
        {
            // a free 2x2 square on the chessboard: the "o" shape fits, and still no line is completed
            openGame([[0, 0], [1, 1]]);

            cy.get('#shape-chest-button').click();
            cy.get('#inventory .inventory-item').should('have.length', SHAPES.length + 1);

            cy.get('#playgrid .play-cell').should('have.length', SIZE * SIZE);
            cy.get('#popup-overlay').should('not.exist');
        });
    });
});
