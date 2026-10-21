describe('Tetris E2E test', () =>
{
    it('opens the page and checks the title', () =>
    {
        cy.visit('http://localhost:5500');
        cy.title().should('eq', 'Tetris');
    });
});
