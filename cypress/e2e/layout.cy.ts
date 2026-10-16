// Exercise real page components with isolated fixtures; no Firebase writes or sign-in.
describe('MovieMatch responsive component layouts', () => {
  [
    { width: 320, columns: 2 },
    { width: 768, columns: 3 },
    { width: 1024, columns: 4 },
    { width: 1440, columns: 6 },
  ].forEach(({ width, columns }) => {
    ['dark', 'light'].forEach((theme) => {
      it(`uses ${columns} watchlist columns in ${theme} mode at ${width}px`, () => {
        cy.viewport(width, 1000);
        cy.visit('/cypress/fixtures/ui/index.html?screen=watchlist');
        cy.contains('h1', 'My Watchlist').should('be.visible');
        if (theme === 'light') cy.get('ion-button.theme-toggle').click();
        cy.get('html').should('have.attr', 'data-theme', theme);
        cy.get('.movie-card').should('have.length', 12);
        cy.get('.movie-grid').then(($grid) => {
          const grid = $grid[0];
          expect(getComputedStyle(grid).gridTemplateColumns.split(' ')).to.have.length(columns);
          expect(grid.getBoundingClientRect().right).to.be.at.most(width);
        });
        cy.screenshot(`watchlist-${theme}-${width}`, { capture: 'viewport' });
        cy.get('.movie-favorite-button').first().click();
        cy.contains('11 movies saved').should('be.visible');
      });
    });
  });

  ['empty-watchlist', 'matching', 'profile', 'disabled', 'onboarding'].forEach((screen) => {
    ['dark', 'light'].forEach((theme) => {
      it(`renders ${screen} in ${theme} mode on mobile`, () => {
        cy.viewport(390, 1000);
        cy.visit(`/cypress/fixtures/ui/index.html?screen=${screen}`);
        cy.get('h1').should('be.visible');
        if (theme === 'light') cy.get('ion-button.theme-toggle').click();
        cy.get('.page-shell').then(($shell) => {
          expect($shell[0].scrollWidth).to.be.at.most(390);
        });
        if (screen === 'profile') {
          cy.contains('ion-button', 'Edit profile').click();
          cy.get('input[name="firstName"]').should('have.value', 'Test');
          cy.contains('ion-button', 'Cancel').click();
          cy.contains('ion-button', 'Change password').click();
          cy.get('input[name="newPassword"]').should('be.visible');
        }
        if (screen === 'disabled' || screen === 'onboarding') cy.get('ion-tab-bar').should('not.exist');
        cy.screenshot(`${screen}-${theme}-390`, { capture: 'viewport' });
      });
    });
  });

  it('renders discovery search, collections, ratings, and filters with TMDB responses', () => {
    cy.viewport(1440, 1000);
    cy.intercept('GET', '**/genre/movie/list*', { genres: [{ id: 28, name: 'Action' }] });
    cy.intercept('GET', '**/movie/popular*', { page: 1, total_pages: 1, total_results: 6, results: Array.from({ length: 6 }, (_, index) => ({ id: index + 1, title: `Discovery test ${index + 1}`, overview: '', poster_path: null, release_date: '2026-01-01', vote_average: 7.5 })) });
    cy.visit('/cypress/fixtures/ui/index.html?screen=discovery');
    cy.contains('h1', 'Discover your next favorite.').should('be.visible');
    cy.get('.movie-card').should('have.length', 6);
    cy.get('.movie-rating').first().should('contain.text', '7.5');
    cy.get('.collection-tabs ion-segment-button').should('have.length', 6);
    cy.get('.genre-select').should('be.visible');
    cy.screenshot('discovery-dark-1440', { capture: 'viewport' });
  });
});
