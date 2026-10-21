describe('Tetris chests', () =>
{
    beforeEach(() =>
    {
        cy.visit('http://localhost:5500');

        // a game has to be running (fresh database): choose the difficulty and start, if a game is already saved, the line below should be commented out
        // cy.get('#start-game-button').click();
        cy.get('#new-game-button').click();
        cy.get('#start-game-button').click();
    });

    it('chest prices are shown on the buttons', () =>
    {
        cy.get('#shape-chest-button').should('have.text', '100 $');
        cy.get('#upgrade-chest-button').should('have.text', '2500 $');
        cy.get('#buff-chest-button').should('have.text', '5000 $');
    });

    it('shape chest gives a shape to the inventory', () =>
    {
        cy.get('#shape-chest-button').click();
        cy.get('#inventory .inventory-item').should('have.length', 1);
    });

    it('upgrade chest needs more money than the start money', () =>
    {
        cy.get('#upgrade-chest-button').click();
        cy.contains('Not enough money').should('be.visible');
    });

    it('buff chest needs more money than the start money', () =>
    {
        cy.get('#buff-chest-button').click();
        cy.contains('Not enough money').should('be.visible');
    });
});