import { DIFFICULTIES, cellCount, cellWidth, expectInsideViewport, inProgressGame, installBackend, startNewGame, visitGame } from './backend';

const DESKTOP = [1280, 720];
const PHONE = [375, 667];

describe('Grid: size after "start game"', () =>
{
    beforeEach(() =>
    {
        cy.viewport(...DESKTOP);
    });

    DIFFICULTIES.forEach(({ id, name, grid_size }) =>
    {
        it(`creates a ${grid_size}x${grid_size} board on "${name}"`, () =>
        {
            installBackend();
            visitGame();
            startNewGame(id);

            cy.get('#playgrid .playgrid-grid').should('be.visible');
            cy.get('#playgrid .play-cell').should('have.length', cellCount(grid_size));

            // the CSS grid has the same number of columns and rows
            cy.get('#playgrid .playgrid-grid').then(($grid) =>
            {
                const style = $grid[0].ownerDocument.defaultView.getComputedStyle($grid[0]);

                expect(style.display).to.equal('grid');
                expect(style.gridTemplateColumns.split(' ')).to.have.length(grid_size);
                expect(style.gridTemplateRows.split(' ')).to.have.length(grid_size);
            });
        });
    });

    it('lays the cells out in rows of the same length', () =>
    {
        installBackend();
        visitGame();
        startNewGame('2');

        cy.get('#playgrid .play-cell').then(($cells) =>
        {
            const firstRowTop = Math.round($cells[0].getBoundingClientRect().top);
            const firstRow = [...$cells].filter((cell) => Math.round(cell.getBoundingClientRect().top) === firstRowTop);

            expect(firstRow).to.have.length(6);
        });
    });

    it('starts with an empty board', () =>
    {
        installBackend();
        visitGame();
        startNewGame('1');

        cy.get('#playgrid .play-cell').should('have.length', 64);
        cy.get('#playgrid .play-cell-filled').should('not.exist');
    });

    // the size must come from the grid_size field of the table, not from numbers written into the code
    [5, 7, 9].forEach((gridSize, index) =>
    {
        it(`follows the grid_size field of the table (${gridSize}x${gridSize})`, () =>
        {
            installBackend({
                DIFFICULTY:
                [
                    { id: '0', name: 'easy', grid_size: 5 },
                    { id: '1', name: 'normal', grid_size: 7 },
                    { id: '2', name: 'hard', grid_size: 9 },
                ],
            });
            visitGame();

            cy.get('#grid-size-select option').eq(index).should('contain.text', `${gridSize}×${gridSize}`);
            startNewGame(String(index));

            cy.get('#playgrid .play-cell').should('have.length', cellCount(gridSize));
        });
    });
});

describe('Grid: responsive', () =>
{
    // the tests compare the page with itself (cells with the grid, desktop with phone) instead of fixed pixel values,
    // so they give the same result in any browser window.
    const NORMAL = DIFFICULTIES.find((difficulty) => difficulty.name === 'normal');
    const COLUMNS = NORMAL.grid_size;

    function openBoard()
    {
        installBackend(inProgressGame({ difficultyId: NORMAL.id }));
        visitGame();
        cy.get('#playgrid .play-cell').should('have.length', cellCount(COLUMNS));
    }

    [
        { name: 'phone', size: PHONE },
        { name: 'desktop', size: DESKTOP },
    ].forEach(({ name, size }) =>
    {
        it(`fills the grid with the cells on a ${name}`, () =>
        {
            cy.viewport(...size);
            openBoard();

            cy.get('#playgrid .playgrid-grid').then(($grid) =>
            {
                const gridRect = $grid[0].getBoundingClientRect();
                const gap = parseFloat($grid[0].ownerDocument.defaultView.getComputedStyle($grid[0]).columnGap) || 0;

                cy.get('#playgrid .play-cell').then(($cells) =>
                {
                    const first = $cells[0].getBoundingClientRect();
                    const last = $cells[$cells.length - 1].getBoundingClientRect();

                    expect(first.width, 'a cell has a size').to.be.greaterThan(0);
                    expect(COLUMNS * first.width + (COLUMNS - 1) * gap, 'columns + gaps = grid width').to.be.closeTo(gridRect.width, 2);
                    expect(last.right, 'last cell at the right edge of the grid').to.be.closeTo(gridRect.right, 2);
                    expect(last.bottom, 'last cell at the bottom edge of the grid').to.be.closeTo(gridRect.bottom, 2);
                });
            });
        });
    });

    it('keeps the board inside the screen on a phone', () =>
    {
        cy.viewport(...PHONE);
        openBoard();

        expectInsideViewport(['#playgrid', '#playgrid .playgrid-grid']);
    });

    it('makes the cells smaller when the screen gets smaller', () =>
    {
        const widths = {};

        cy.viewport(...DESKTOP);
        openBoard();
        cellWidth().then((width) => { widths.desktop = width; });

        // same page, only the window is resized
        cy.viewport(...PHONE);
        cellWidth().then((width) => { widths.phone = width; });

        cy.then(() =>
        {
            expect(widths.phone, 'phone cell').to.be.lessThan(widths.desktop);
        });
    });

    it('shows the start popup completely on a phone and starts the game from it', () =>
    {
        const easy = DIFFICULTIES.find((difficulty) => difficulty.name === 'easy');

        cy.viewport(...PHONE);
        installBackend();
        visitGame();

        cy.get('#popup-window').should('be.visible');
        expectInsideViewport(['#popup-window', '#grid-size-select', '#start-game-button']);

        startNewGame(easy.id);
        cy.get('#playgrid .play-cell').should('have.length', cellCount(easy.grid_size));
    });
});
