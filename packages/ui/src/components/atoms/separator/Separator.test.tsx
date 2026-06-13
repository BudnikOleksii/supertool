import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Separator } from './Separator';

describe('Separator', () => {
  it('renders a horizontal decorative separator by default', () => {
    const { container } = render(<Separator />);
    const node = container.querySelector('[data-slot="separator"]');

    expect(node?.getAttribute('data-orientation')).toBe('horizontal');
  });

  it('exposes the separator role when not decorative', () => {
    render(<Separator decorative={false} orientation="vertical" />);

    expect(screen.getByRole('separator').getAttribute('data-orientation')).toBe('vertical');
  });
});
