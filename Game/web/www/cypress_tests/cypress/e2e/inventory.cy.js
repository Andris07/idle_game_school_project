describe('Tetris inventory', () =>
{
    beforeEach(() =>
    {
        cy.visit('http://localhost:5500');

        // a game has to be running (fresh database): choose the difficulty and start, if a game is already saved, the line below should be commented out
        // cy.get('#start-game-button').click();
        cy.get('#new-game-button').click();
        cy.get('#start-game-button').click();
    });

    it('inventory is empty at the start', () =>
    {
        cy.get('#inventory .inventory-item').should('not.exist');
    });

    it('a new shape appears in the inventory after opening a shape chest', () =>
    {
        cy.get('#shape-chest-button').click();

        cy.get('#inventory .inventory-item').should('have.length', 1)
            .within(() =>
            {
                cy.get('.shape-cell').should('have.length', 16);
                cy.get('.shape-cell-filled').should('have.length', 4);
                cy.get('p').invoke('text').should('match', /^\d+\$$/);
                cy.get('.rotate-shape-button').should('be.visible');
            });
    });

    it('the inventory is kept after reloading the page', () =>
    {
        cy.get('#shape-chest-button').click();
        cy.get('#inventory .inventory-item').should('have.length', 1);

        cy.reload();
        cy.get('#inventory .inventory-item').should('have.length', 1);
    });
});