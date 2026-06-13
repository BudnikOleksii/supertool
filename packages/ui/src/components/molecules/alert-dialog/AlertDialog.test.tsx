import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, it } from 'vitest';

import { Button } from '../../atoms/button/Button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './AlertDialog';

beforeAll(() => {
  globalThis.HTMLElement.prototype.scrollIntoView = () => {};
  globalThis.HTMLElement.prototype.hasPointerCapture = () => false;
  globalThis.HTMLElement.prototype.releasePointerCapture = () => {};
});

const renderAlertDialog = () =>
  render(
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button>Delete account</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this account?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive">Delete</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  );

describe('AlertDialog', () => {
  it('opens with title, description, and both actions', () => {
    renderAlertDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));

    screen.getByRole('alertdialog');
    screen.getByText('Delete this account?');
    screen.getByText('This action cannot be undone.');
    screen.getByRole('button', { name: 'Cancel' });
    screen.getByRole('button', { name: 'Delete' });
  });
});
