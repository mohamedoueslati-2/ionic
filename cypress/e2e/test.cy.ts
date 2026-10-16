describe('MovieMatch public screens and appearance', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.contains('h1', 'Welcome back', { timeout: 15000 }).should('be.visible');
  });

  it('switches themes and remembers the selection after reloading', () => {
    cy.get('html').should('have.attr', 'data-theme', 'dark');
    cy.get('ion-button.theme-toggle').click();
    cy.get('html').should('have.attr', 'data-theme', 'light');
    cy.reload();
    cy.contains('h1', 'Welcome back').should('be.visible');
    cy.get('html').should('have.attr', 'data-theme', 'light');
    cy.get('ion-button.theme-toggle').click();
    cy.get('html').should('have.attr', 'data-theme', 'dark');
  });

  it('opens signup and password recovery while preserving required form fields', () => {
    cy.contains('ion-button', 'Sign Up').click();
    cy.contains('h1', 'Create your account').should('be.visible');
    cy.get('input[name="firstName"]').should('have.attr', 'required');
    cy.get('input[name="lastName"]').should('have.attr', 'required');
    cy.get('input[name="age"]').should('have.attr', 'min', '1');
    cy.get('input[name="password"]').should('have.attr', 'minlength', '6');
    cy.contains('ion-button', 'Back to Login').click();
    cy.contains('ion-button', 'Forgot password?').click();
    cy.contains('h1', 'Forgot your password?').should('be.visible');
    cy.get('input[name="resetEmail"]').should('have.attr', 'type', 'email');
    cy.contains('ion-button', 'Back to Login').click();
    cy.contains('h1', 'Welcome back').should('be.visible');
  });

  [320, 390, 768, 1440].forEach((width) => {
    ['dark', 'light'].forEach((theme) => {
      it(`fits the ${theme} authentication layout at ${width}px`, () => {
        cy.viewport(width, 900);
        if (theme === 'light') cy.get('ion-button.theme-toggle').click();
        cy.get('html').should('have.attr', 'data-theme', theme);
        cy.get('.auth-form-panel').should('be.visible');
        cy.get('.auth-form-panel').then(($panel) => {
          const rect = $panel[0].getBoundingClientRect();
          expect(rect.left).to.be.at.least(0);
          expect(rect.right).to.be.at.most(width);
        });
        cy.screenshot(`login-${theme}-${width}`, { capture: 'viewport' });
      });
    });
  });
});
