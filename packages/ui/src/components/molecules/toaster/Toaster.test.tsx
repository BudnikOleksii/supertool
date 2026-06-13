import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { toast } from './toast';
import { Toaster } from './Toaster';

describe('Toaster', () => {
  it('renders the sonner notification region', () => {
    const { container } = render(<Toaster theme="light" />);

    expect(container.querySelector('section')).not.toBeNull();
  });

  it('exposes the imperative toast api', () => {
    expect(typeof toast).toBe('function');
  });
});
