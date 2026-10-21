describe('Tetris menu buttons', () =>
{
    beforeEach(() =>
    {
        cy.visit('/');

        // a game has to be running (fresh database): choose the difficulty and start, if a game is already saved, the line below should be commented out
        // cy.get('#start-game-button').click();
    });

    it('github button points to the repository', () =>
    {
        cy.get('.repository-link')
            .should('have.attr', 'href', 'https://github.com/Andris07/idle_game_school_project');
    });

    it('info button opens the game info popup', () =>
    {
        cy.get('#info-button').click();
        cy.contains('Game info').should('be.visible');
    });

    it('restart button opens the difficulty popup', () =>
    {
        cy.get('#new-game-button').click();
        cy.contains('choose difficulty').should('be.visible');
    });

    it('light mode button switches the theme', () =>
    {
        cy.get('#theme-toggle').click();
        cy.get('html').should('have.attr', 'data-theme', 'light');
    });
});