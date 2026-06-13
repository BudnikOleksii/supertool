import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AspectRatio } from './AspectRatio';

describe('AspectRatio', () => {
  it('renders its children', () => {
    render(
      <AspectRatio ratio={1}>
        <img src="/cover.png" alt="Cover" />
      </AspectRatio>,
    );

    screen.getByRole('img', { name: 'Cover' });
  });

  it('exposes the aspect-ratio data slot', () => {
    const { container } = render(
      <AspectRatio>
        <span>content</span>
      </AspectRatio>,
    );

    expect(container.querySelector('[data-slot="aspect-ratio"]')).not.toBeNull();
  });
});
