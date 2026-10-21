const NAVY_BLUE = 'rgb(0, 0, 32)';                  // --surface in dark mode
const NAVY_BLUE_LIGHT = 'rgb(25, 25, 54)';          // --itemcont in dark mode
const BABY_BLUE = 'rgb(173, 215, 246)';             // --surface in light mode
const BABY_BLUE_LIGHT = 'rgb(187, 222, 251)';       // --itemcont in light mode
const WARM_PINK = 'rgb(238, 66, 102)';              // --accent in dark mode
const ORANGE = 'rgb(255, 145, 0)';                  // --secondary

const DIFFICULTIES =
[
    { name: 'easy', size: 10 },
    { name: 'normal', size: 8 },
    { name: 'hard', size: 6 },
];

// opens the page with the given theme (default is dark) and waits until the popup is ready (the difficulties are loaded)
function openStartPopup(theme = 'dark')
{
    cy.visit('/',
    {
        onBeforeLoad(window)
        {
            window.localStorage.setItem('theme', theme);
        },
    });

    cy.get('#popup-window').should('be.visible');
    cy.get('#grid-size-select option').should('have.length', DIFFICULTIES.length);
}

describe('Game start popup: html elements', () =>
{
    beforeEach(() =>
    {
        cy.intercept('GET', '**/GAME_SESSION',
        {
            id: '0',
            difficulty_id: null,
            money: 0,
            total_earned: 0,
            last_save_at: '',
            started_at: '',
        });
        cy.intercept('PUT', '**/GAME_SESSION', { statusCode: 200, body: {} }).as('saveSession');

        openStartPopup();
    });

    it('shows the popup window', () =>
    {
        cy.get('#popup-window').should('exist').and('be.visible');
    });

    it('shows the overlay behind the popup window', () =>
    {
        cy.get('#popup-overlay').should('have.length', 1).and('be.visible');
        cy.get('#popup-overlay #popup-window').should('exist');
        // the popup is inside the overlay
    });

    it('covers the whole page with the overlay', () =>
    {
        cy.get('#popup-overlay')
            .should('have.css', 'position', 'fixed')
            .and('have.css', 'background-color', 'rgba(0, 0, 0, 0.6)');

        cy.window().then((window) =>
        {
            cy.get('#popup-overlay').then(($overlay) =>
            {
                const rect = $overlay[0].getBoundingClientRect();

                expect(rect.left).to.equal(0);
                expect(rect.top).to.equal(0);
                expect(rect.width).to.equal(window.innerWidth);
                expect(rect.height).to.equal(window.innerHeight);
            });
        });
    });

    it('shows the overlay above the page content', () =>
    {
        cy.get('#popup-overlay').should('have.css', 'z-index', '9999');
    });

    it('centers the popup window in the overlay', () =>
    {
        cy.get('#popup-overlay')
            .should('have.css', 'display', 'flex')
            .and('have.css', 'justify-content', 'center')
            .and('have.css', 'align-items', 'center');
 
        cy.get('#popup-overlay').then(($overlay) =>
        {
            cy.get('#popup-window').then(($popup) =>
            {
                const overlay = $overlay[0];
                const popup = $popup[0];
 
                const freeLeft = popup.offsetLeft;
                const freeRight = overlay.clientWidth - popup.offsetLeft - popup.offsetWidth;
                const freeTop = popup.offsetTop;
                const freeBottom = overlay.clientHeight - popup.offsetTop - popup.offsetHeight;
 
                expect(freeLeft, 'left and right space').to.be.closeTo(freeRight, 1);
                expect(freeTop, 'top and bottom space').to.be.closeTo(freeBottom, 1);
            });
        });
    });

    it('has the "choose difficulty" title', () =>
    {
        cy.get('#popup-window h2')
            .should('be.visible')
            .and('have.text', 'choose difficulty');
    });

    it('has a dropdown list', () =>
    {
        cy.get('#popup-window select#grid-size-select').should('be.visible');
    });

    it('has a "start game" button', () =>
    {
        cy.get('#popup-window button#start-game-button')
            .should('be.visible')
            .and('have.text', 'start game')
            .and('not.be.disabled');
    });
});

describe('Game start popup: difficulty list', () =>
{
    beforeEach(() =>
    {
        cy.intercept('GET', '**/GAME_SESSION', { id: '0', difficulty_id: null, money: 0, last_save_at: '' });
        cy.intercept('PUT', '**/GAME_SESSION', { statusCode: 200, body: {} });

        openStartPopup();
    });

    it('has 3 difficulty levels', () =>
    {
        cy.get('#grid-size-select option').should('have.length', 3);
    });

    it('has the easy, normal and hard levels with their grid sizes', () =>
    {
        DIFFICULTIES.forEach(({ name, size }, index) =>
        {
            cy.get('#grid-size-select option').eq(index).should('have.text', `${name} (${size}×${size})`);
        });
    });

    it('lets the player choose only one level at a time', () =>
    {
        // a single choice list (no "multiple" attribute), exactly one option is selected
        cy.get('#grid-size-select').should('not.have.attr', 'multiple');

        DIFFICULTIES.forEach(({ name, size }, index) =>
        {
            cy.get('#grid-size-select').select(`${name} (${size}×${size})`);

            cy.get('#grid-size-select').then(($select) =>
            {
                expect($select[0].selectedOptions).to.have.length(1);
                expect($select[0].selectedIndex).to.equal(index);
            });
        });
    });
});

describe('Game start popup: start game', () =>
{
    beforeEach(() =>
    {
        cy.intercept('GET', '**/GAME_SESSION', { id: '0', difficulty_id: null, money: 0, last_save_at: '' });
        cy.intercept('PUT', '**/GAME_SESSION', { statusCode: 200, body: {} }).as('saveSession');

        openStartPopup();
    });

    it('closes the popup window and the overlay on click', () =>
    {
        cy.get('#start-game-button').click();

        cy.get('#popup-window').should('not.exist');
        cy.get('#popup-overlay').should('not.exist');
    });

    it('saves the new game and builds the board of the chosen difficulty', () =>
    {
        cy.get('#grid-size-select').select('hard (6×6)');
        cy.get('#start-game-button').click();

        cy.wait('@saveSession').its('request.body.difficulty_id').should('eq', '2');
        cy.get('#playgrid .play-cell').should('have.length', 36);
    });

    it('does not open the popup again after it was closed', () =>
    {
        cy.get('#start-game-button').click();
        cy.get('#popup-overlay').should('not.exist');

        cy.get('#popup-overlay').should('have.length', 0);
    });
});

describe('Game start popup: appearance (dark mode)', () =>
{
    beforeEach(() =>
    {
        cy.intercept('GET', '**/GAME_SESSION', { id: '0', difficulty_id: null, money: 0, last_save_at: '' });
        cy.intercept('PUT', '**/GAME_SESSION', { statusCode: 200, body: {} });

        openStartPopup('dark');
    });

    it('has a 3px solid pink (accent) border on the popup window', () =>
    {
        cy.get('#popup-window')
            .should('have.css', 'border-top-width', '3px')
            .and('have.css', 'border-top-style', 'solid')
            .and('have.css', 'border-top-color', WARM_PINK);
    });

    it('has the same pink on the title, the dropdown border and the popup border', () =>
    {
        cy.get('#popup-window').invoke('css', 'border-top-color').then((popupBorder) =>
        {
            expect(popupBorder).to.equal(WARM_PINK);

            cy.get('#popup-window h2').should('have.css', 'color', popupBorder);

            cy.get('#grid-size-select')
                .should('have.css', 'border-top-color', popupBorder)
                .and('have.css', 'border-top-style', 'solid')
                .and('have.css', 'border-top-width', '2px');
        });
    });

    it('has a navy-blue-light to navy-blue gradient background', () =>
    {
        cy.get('#popup-window')
            .invoke('css', 'background-image')
            .then((background) =>
            {
                expect(background).to.contain('linear-gradient');
                expect(background).to.contain(NAVY_BLUE_LIGHT);
                expect(background).to.contain(NAVY_BLUE);

                // the gradient goes from navy-blue-light (top) to navy-blue (bottom)
                expect(background.indexOf(NAVY_BLUE_LIGHT)).to.be.lessThan(background.indexOf(NAVY_BLUE));
            });
    });

    it('has a rounded, orange "start game" button', () =>
    {
        cy.get('#start-game-button')
            .should('have.css', 'background-color', ORANGE)
            .and('have.css', 'border-radius', '8px')
            .and('have.css', 'cursor', 'pointer');
    });

    it('has an uppercase title', () =>
    {
        cy.get('#popup-window h2').should('have.css', 'text-transform', 'uppercase');
    });

    it('keeps the popup window inside the screen', () =>
    {
        cy.window().then((window) =>
        {
            cy.get('#popup-window').then(($popup) =>
            {
                const rect = $popup[0].getBoundingClientRect();

                expect(rect.left).to.be.at.least(0);
                expect(rect.right).to.be.at.most(window.innerWidth);
                expect(rect.top).to.be.at.least(0);
                expect(rect.bottom).to.be.at.most(window.innerHeight);
            });
        });
    });
});

describe('Game start popup: appearance (light mode)', () =>
{
    beforeEach(() =>
    {
        cy.intercept('GET', '**/GAME_SESSION', { id: '0', difficulty_id: null, money: 0, last_save_at: '' });
        cy.intercept('PUT', '**/GAME_SESSION', { statusCode: 200, body: {} });

        openStartPopup('light');
    });

    it('has a baby-blue-light to baby-blue gradient background', () =>
    {
        cy.get('#popup-window')
            .invoke('css', 'background-image')
            .then((background) =>
            {
                expect(background).to.contain(BABY_BLUE_LIGHT);
                expect(background).to.contain(BABY_BLUE);
            });
    });

    it('keeps the orange "start game" button', () =>
    {
        cy.get('#start-game-button').should('have.css', 'background-color', ORANGE);
    });
});
