import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert, AlertAction, AlertDescription, AlertTitle } from './Alert';

describe('Alert', () => {
  it('renders content inside an alert role', () => {
    render(
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Your balance is low.</AlertDescription>
      </Alert>,
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Heads up');
    expect(alert.textContent).toContain('Your balance is low.');
  });

  it('renders the title as a level-5 heading', () => {
    render(
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
      </Alert>,
    );

    screen.getByRole('heading', { level: 5, name: 'Heads up' });
  });

  it('exposes the alert data slot for the destructive variant', () => {
    render(
      <Alert variant="destructive">
        <AlertTitle>Failed</AlertTitle>
      </Alert>,
    );

    expect(screen.getByRole('alert').getAttribute('data-slot')).toBe('alert');
  });

  it('renders an action region', () => {
    render(
      <Alert>
        <AlertAction>
          <button type="button">Retry</button>
        </AlertAction>
      </Alert>,
    );

    screen.getByRole('button', { name: 'Retry' });
  });
});
