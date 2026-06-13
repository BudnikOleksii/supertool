import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders a skeleton placeholder', () => {
    const { container } = render(<Skeleton />);

    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it('applies width and height as inline styles', () => {
    const { container } = render(<Skeleton width={120} height="2rem" />);
    const node = container.querySelector<HTMLDivElement>('[data-slot="skeleton"]');

    expect(node?.style.width).toBe('120px');
    expect(node?.style.height).toBe('2rem');
  });
});
