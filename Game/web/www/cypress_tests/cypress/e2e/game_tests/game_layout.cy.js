import { inProgressGame, installBackend, visitGame } from './backend';

const DESKTOP = [1280, 720];
const PHONE = [375, 667];

// the colors of colors.css
const THEMES =
{
    dark:
    {
        background: 'rgb(30, 30, 30)',      // --black
        text: 'rgb(255, 255, 255)',         // --white
        surface: 'rgb(0, 0, 32)',           // --navy-blue
        itemcont: 'rgb(25, 25, 54)',        // --navy-blue-light
        accent: 'rgb(238, 66, 102)',        // --warm-pink
        variables:
        {
            '--background': '#1e1e1e',
            '--background-text': '#ffffff',
            '--surface': '#000020',
            '--itemcont': '#191936',
            '--text': '#ffffff',
            '--accent': '#ee4266',
            '--secondary': '#ff9100',
            '--valid': '#2ecc71',
            '--invalid': '#e53935',
        },
    },
    light: 
    {
        background: 'rgb(255, 255, 255)',   // --white
        text: 'rgb(30, 30, 30)',            // --black
        surface: 'rgb(173, 215, 246)',      // --baby-blue
        itemcont: 'rgb(187, 222, 251)',     // --baby-blue-light
        accent: 'rgb(115, 113, 252)',       // --warm-purple
        variables:
        {
            '--background': '#ffffff',
            '--background-text': '#1e1e1e',
            '--surface': '#add7f6',
            '--itemcont': '#bbdefb',
            '--text': '#1e1e1e',
            '--accent': '#7371fc',
            '--secondary': '#ff9100',
            '--valid': '#2ecc71',
            '--invalid': '#e53935',
        },
    },
};

const ORANGE = 'rgb(255, 145, 0)';          // --orange: the same in both themes

function openGame(theme)
{
    installBackend(inProgressGame({ difficultyId: '1' }));
    visitGame(theme);
    cy.get('#playgrid .play-cell').should('have.length', 64);
}

describe('Layout: the two main panels', () =>
{
    beforeEach(() =>
    {
        cy.viewport(...DESKTOP);
        openGame('dark');
    });

    it('has exactly two main panels in the container', () =>
    {
        cy.get('main.container > .itemcont').should('have.length', 2);
    });

    it('has the shop on the left and the board with the "playgrid" id on the right', () =>
    {
        cy.get('main.container > .itemcont').eq(0).should('have.id', 'shopgrid');
        cy.get('main.container > .itemcont').eq(1).should('have.id', 'playgrid');

        cy.get('#shopgrid').then(($shop) =>
        {
            cy.get('#playgrid').then(($play) =>
            {
                const shop = $shop[0].getBoundingClientRect();
                const play = $play[0].getBoundingClientRect();

                expect(play.left, 'board is right of the shop').to.be.at.least(shop.right - 1);
                expect(play.top, 'same top edge').to.be.closeTo(shop.top, 2);
            });
        });
    });

    it('has the chests and the inventory in the shop, and the grid in the board', () =>
    {
        cy.get('#shopgrid #chests .chest').should('have.length', 3);
        cy.get('#shopgrid #shape-chest-button').should('be.visible');
        cy.get('#shopgrid #upgrade-chest-button').should('be.visible');
        cy.get('#shopgrid #buff-chest-button').should('be.visible');
        cy.get('#shopgrid #inventory .inventory-item').should('have.length', 1);

        cy.get('#playgrid > .playgrid-grid').should('have.length', 1);
        cy.get('#playgrid #shopgrid').should('not.exist');
    });

    it('has the menu with the icons in the right order', () =>
    {
        cy.get('.menu .menu-section').should('have.length', 3);

        // left: github and info icon
        cy.get('.menu-repository a.repository-link').should('be.visible');
        cy.get('.menu-repository #info-button').should('be.visible');

        cy.get('.menu-repository a.repository-link').then(($github) =>
        {
            cy.get('#info-button').then(($info) =>
            {
                expect($info[0].getBoundingClientRect().left, 'info icon right of GitHub').to.be.at.least($github[0].getBoundingClientRect().right - 1);
            });
        });

        // middle: timer and money
        cy.get('.menu-info #game-timer').should('be.visible');
        cy.get('.menu-info #player-money').should('be.visible');

        // right: new game and theme switch
        cy.get('.menu-theme #new-game-button').should('be.visible');
        cy.get('.menu-theme #theme-toggle').should('be.visible');
    });

    it('stacks the panels on a phone: shop first, board second', () =>
    {
        cy.viewport(...PHONE);

        cy.get('main.container > .itemcont').eq(0).should('have.id', 'shopgrid');
        cy.get('main.container > .itemcont').eq(1).should('have.id', 'playgrid');

        cy.get('#shopgrid').then(($shop) =>
        {
            cy.get('#playgrid').then(($play) =>
            {
                expect($play[0].getBoundingClientRect().top).to.be.at.least($shop[0].getBoundingClientRect().bottom - 1);
            });
        });
    });
});

Object.entries(THEMES).forEach(([theme, colors]) =>
{
    describe(`Colors: ${theme} theme`, () =>
    {
        beforeEach(() =>
        {
            cy.viewport(...DESKTOP);
            openGame(theme);
        });

        it('sets the theme on the page', () =>
        {
            cy.get('html').should('have.attr', 'data-theme', theme);
        });

        it('gives the right values to the CSS variables', () =>
        {
            cy.document().then((doc) =>
            {
                const style = doc.defaultView.getComputedStyle(doc.documentElement);

                Object.entries(colors.variables).forEach(([name, value]) =>
                {
                    expect(style.getPropertyValue(name).trim().toLowerCase(), name).to.equal(value);
                });
            });
        });

        it('colors the page, the container, the menu and the two panels', () =>
        {
            cy.get('body')
                .should('have.css', 'background-color', colors.background)
                .and('have.css', 'color', colors.text);

            cy.get('main.container').should('have.css', 'background-color', colors.surface);
            cy.get('.menu').should('have.css', 'background-color', colors.surface);

            ['#shopgrid', '#playgrid'].forEach((selector) =>
            {
                cy.get(selector)
                    .should('have.css', 'background-color', colors.itemcont)
                    .and('have.css', 'border-top-width', '3px')
                    .and('have.css', 'border-top-style', 'solid')
                    .and('have.css', 'border-top-color', colors.accent);
            });
        });

        it('colors the board cells and the placed shape', () =>
        {
            cy.get('#playgrid .play-cell:not(.play-cell-filled)').first()
                .should('have.css', 'background-color', colors.surface)
                .and('have.css', 'border-top-color', colors.accent);

            cy.get('#playgrid .play-cell-filled').should('have.length', 4);
            cy.get('#playgrid .play-cell-filled').first()
                .should('have.css', 'background-color', ORANGE)
                .and('have.css', 'border-top-color', ORANGE);
        });

        it('colors the inventory item and the chest buttons', () =>
        {
            cy.get('#inventory .inventory-item').first()
                .should('have.css', 'background-color', colors.surface)
                .and('have.css', 'border-top-color', colors.accent);

            cy.get('#inventory .shape-cell-filled').first().should('have.css', 'background-color', ORANGE);

            ['#shape-chest-button', '#upgrade-chest-button', '#buff-chest-button'].forEach((selector) =>
            {
                cy.get(selector).should('have.css', 'background-color', ORANGE);
            });
        });

        it('colors the menu buttons with the accent color', () =>
        {
            ['#info-button', '#new-game-button', '#theme-toggle'].forEach((selector) =>
            {
                cy.get(selector)
                    .should('have.css', 'border-top-color', colors.accent)
                    .and('have.css', 'border-top-width', '2px');
            });
        });
    });
});

describe('Colors: switching the theme', () =>
{
    beforeEach(() =>
    {
        cy.viewport(...DESKTOP);
        openGame('dark');
    });

    it('changes the colors with the theme switch and remembers the theme after a reload', () =>
    {
        cy.get('main.container').should('have.css', 'background-color', THEMES.dark.surface);

        cy.get('#theme-toggle').click();

        cy.get('html').should('have.attr', 'data-theme', 'light');
        cy.get('main.container').should('have.css', 'background-color', THEMES.light.surface);
        cy.get('#playgrid').should('have.css', 'border-top-color', THEMES.light.accent);
        cy.window().its('localStorage').invoke('getItem', 'theme').should('eq', 'light');

        cy.reload();
        cy.get('#playgrid .play-cell').should('have.length', 64);

        cy.get('html').should('have.attr', 'data-theme', 'light');
        cy.get('main.container').should('have.css', 'background-color', THEMES.light.surface);
    });

    it('does not let the info icon turn with the theme switch (it is not the sun / moon icon)', () =>
    {
        cy.get('#info-button img').should('have.attr', 'src', './src/info.svg').and('have.class', 'info-icon');

        cy.get('#theme-toggle').click();

        cy.get('#info-button img').should('have.attr', 'src', './src/info.svg');
        cy.get('#info-button img').should('have.css', 'transform', 'none');
    });
});
