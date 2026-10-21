describe('Tetris E2E test', () =>
{
    it('opens the page and checks the title', () =>
    {
        cy.visit('/');
        cy.title().should('eq', 'Tetris');
    });
});
