import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './DropdownMenu';

beforeAll(() => {
  globalThis.HTMLElement.prototype.scrollIntoView = () => {};
  globalThis.HTMLElement.prototype.hasPointerCapture = () => false;
  globalThis.HTMLElement.prototype.releasePointerCapture = () => {};
});

const renderDropdownMenu = () =>
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );

describe('DropdownMenu', () => {
  it('renders a closed trigger', () => {
    renderDropdownMenu();

    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('reveals the menu items when opened', () => {
    renderDropdownMenu();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Open menu' }), { key: 'Enter' });

    screen.getByRole('menuitem', { name: 'Edit' });
    screen.getByRole('menuitem', { name: 'Delete' });
  });
});
