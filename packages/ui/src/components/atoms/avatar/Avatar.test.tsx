import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar, AvatarFallback, AvatarImage } from './Avatar';

describe('Avatar', () => {
  it('renders the fallback when the image cannot load', () => {
    render(
      <Avatar>
        <AvatarImage src="" alt="Oleksii" />
        <AvatarFallback>OB</AvatarFallback>
      </Avatar>,
    );

    screen.getByText('OB');
  });

  it('exposes the avatar data slot', () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>OB</AvatarFallback>
      </Avatar>,
    );

    expect(container.querySelector('[data-slot="avatar"]')).not.toBeNull();
  });
});
