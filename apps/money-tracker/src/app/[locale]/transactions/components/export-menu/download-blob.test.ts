import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob } from './download-blob';

const OBJECT_URL = 'blob:mock-url';

const prepareAnchor = (): { anchor: HTMLAnchorElement; clickSpy: ReturnType<typeof vi.fn> } => {
  const clickSpy = vi.fn();
  const anchor = document.createElement('a');
  anchor.click = clickSpy;
  vi.spyOn(document, 'createElement').mockReturnValue(anchor);

  return { anchor, clickSpy };
};

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => OBJECT_URL),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('clicks an anchor with the file name and revokes the URL', () => {
    const { anchor, clickSpy } = prepareAnchor();

    downloadBlob({ content: 'a,b,c', fileName: 'transactions.csv', mimeType: 'text/csv' });

    expect(anchor.download).toBe('transactions.csv');
    expect(anchor.href).toContain(OBJECT_URL);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL);
  });
});
