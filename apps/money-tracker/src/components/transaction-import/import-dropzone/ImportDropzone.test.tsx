import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImportDropzone } from './ImportDropzone';

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
  useLocale: () => 'en',
}));

const noop = () => undefined;

const getDropzoneElement = (container: HTMLElement): Element => {
  const dropzone = container.querySelector('[data-drag-over]');

  if (!dropzone) {
    throw new Error('dropzone element not found');
  }

  return dropzone;
};

describe('ImportDropzone', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the idle dropzone with instruction, browse control, and hint', () => {
    render(
      <ImportDropzone
        file={null}
        checkErrorKey={null}
        disabled={false}
        onFileSelect={noop}
        onClear={noop}
      />,
    );

    screen.getByText('dropzoneInstruction');
    screen.getByRole('button', { name: 'dropzoneBrowse' });
    screen.getByText('dropzoneHint');
  });

  it('marks the dropzone on drag-over and clears it on drag-leave', () => {
    const { container } = render(
      <ImportDropzone
        file={null}
        checkErrorKey={null}
        disabled={false}
        onFileSelect={noop}
        onClear={noop}
      />,
    );

    const dropzone = getDropzoneElement(container);

    fireEvent.dragOver(dropzone);
    expect(dropzone.getAttribute('data-drag-over')).toBe('true');

    fireEvent.dragLeave(dropzone);
    expect(dropzone.getAttribute('data-drag-over')).toBe('false');
  });

  it('calls onFileSelect with the dropped file', () => {
    const onFileSelect = vi.fn();
    const file = new File(['[]'], 'transactions.json');
    const { container } = render(
      <ImportDropzone
        file={null}
        checkErrorKey={null}
        disabled={false}
        onFileSelect={onFileSelect}
        onClear={noop}
      />,
    );

    fireEvent.drop(getDropzoneElement(container), { dataTransfer: { files: [file] } });

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it('calls onFileSelect when a file is picked via the input', () => {
    const onFileSelect = vi.fn();
    const file = new File(['[]'], 'transactions.json');
    render(
      <ImportDropzone
        file={null}
        checkErrorKey={null}
        disabled={false}
        onFileSelect={onFileSelect}
        onClear={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText('dropzoneLabel'), { target: { files: [file] } });

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it('renders the selected file card with name, size, and replace/clear controls', () => {
    render(
      <ImportDropzone
        file={new File(['[]'], 'transactions.json')}
        checkErrorKey={null}
        disabled={false}
        onFileSelect={noop}
        onClear={noop}
      />,
    );

    screen.getByText('transactions.json');
    screen.getByRole('button', { name: 'replaceFile' });
    screen.getByRole('button', { name: 'clearFile' });
    expect(screen.queryByText('dropzoneInstruction')).toBeNull();
  });

  it('calls onClear when the clear control is pressed', () => {
    const onClear = vi.fn();
    render(
      <ImportDropzone
        file={new File(['[]'], 'transactions.json')}
        checkErrorKey={null}
        disabled={false}
        onFileSelect={noop}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'clearFile' }));

    expect(onClear).toHaveBeenCalled();
  });

  it('renders the localized pre-check error', () => {
    render(
      <ImportDropzone
        file={null}
        checkErrorKey="fileTooLarge"
        disabled={false}
        onFileSelect={noop}
        onClear={noop}
      />,
    );

    screen.getByText('fileTooLarge');
  });
});
