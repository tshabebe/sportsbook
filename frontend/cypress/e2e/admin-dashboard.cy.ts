describe('Admin Dashboard', () => {
  it('logs in and manages cashiers', () => {
    cy.viewport(1280, 800);

    const dashboardPayload = {
      ok: true,
      range: {
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-07T23:59:59.999Z',
      },
      summary: {
        totalStake: 120,
        totalPaidOut: 40,
        outstandingPayoutAmount: 15,
        netProfit: 80,
        ticketsCount: 6,
        paidTicketsCount: 2,
        outstandingTicketsCount: 1,
      },
      cashiers: [
        {
          retailerId: 7,
          name: 'Cashier One',
          username: 'cashier_one',
          isActive: true,
          totalStake: 120,
          totalPaidOut: 40,
          outstandingPayoutAmount: 15,
          ticketsCount: 6,
          paidTicketsCount: 2,
          outstandingTicketsCount: 1,
          netProfit: 80,
        },
      ],
    };

    cy.intercept('POST', '**/admin/auth/login', {
      statusCode: 200,
      body: {
        ok: true,
        token: 'admin-token-test',
        admin: { username: 'admin' },
      },
    }).as('adminLogin');

    cy.intercept('GET', '**/admin/cashiers*', {
      statusCode: 200,
      body: dashboardPayload,
    }).as('cashiers');

    cy.intercept('POST', '**/admin/cashiers', {
      statusCode: 201,
      body: {
        ok: true,
        cashier: {
          id: 8,
          name: 'Cashier Two',
          username: 'cashier_two',
          isActive: true,
          createdAt: '2026-02-13T12:00:00.000Z',
        },
      },
    }).as('createCashier');

    cy.intercept('PATCH', '**/admin/cashiers/7/password', {
      statusCode: 200,
      body: { ok: true },
    }).as('resetPassword');

    cy.intercept('PATCH', '**/admin/cashiers/7/status', {
      statusCode: 200,
      body: {
        ok: true,
        cashier: { id: 7, isActive: false },
      },
    }).as('updateStatus');

    cy.visit('/admin/login');

    cy.get('input').eq(0).type('admin');
    cy.get('input').eq(1).type('secret123');
    cy.contains('button', 'Sign In').click();

    cy.wait('@adminLogin', { timeout: 20000 });
    cy.wait('@cashiers', { timeout: 20000 });
    cy.contains('Admin Summary', { timeout: 20000 }).should('be.visible');
    cy.contains('Cashier One').should('be.visible');
    cy.contains('Unpaid Liability').parent().contains('Br15.00');

    cy.get('input[placeholder="Name"]').type('Cashier Two');
    cy.get('input[placeholder="Username"]').type('cashier_two');
    cy.get('input[placeholder="Password"]').type('password123');
    cy.contains('button', 'Create').click();
    cy.wait('@createCashier', { timeout: 20000 });
    cy.contains('Cashier cashier_two created').should('be.visible');

    cy.get('input[placeholder="New password"]').first().type('newpass123');
    cy.contains('button', 'Reset Password').first().click();
    cy.wait('@resetPassword', { timeout: 20000 });
    cy.contains('Password changed for cashier_one').should('be.visible');

    cy.contains('button', 'Deactivate').first().click();
    cy.wait('@updateStatus', { timeout: 20000 });
    cy.contains('cashier_one deactivated').should('be.visible');
  });
});
