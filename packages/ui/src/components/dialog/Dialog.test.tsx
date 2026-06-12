import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from '../button/Button';
import { Dialog } from './Dialog';

const DIALOG_TRIGGER = <Button>Open settings</Button>;

const renderDialog = () => {
  render(
    <Dialog
      trigger={DIALOG_TRIGGER}
      title="Settings"
      description="Adjust your preferences"
      closeLabel="Close"
    >
      <p>Dialog body</p>
    </Dialog>,
  );
};

describe('Dialog', () => {
  it('stays closed until the trigger is activated', () => {
    renderDialog();

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on trigger interaction and renders its content', () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeDefined();
    expect(screen.getByText('Dialog body')).toBeDefined();
  });
});
