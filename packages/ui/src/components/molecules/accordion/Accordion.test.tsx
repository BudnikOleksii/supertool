import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './Accordion';

const renderAccordion = () =>
  render(
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger>Is it accessible?</AccordionTrigger>
        <AccordionContent>Yes, it follows WAI-ARIA patterns.</AccordionContent>
      </AccordionItem>
    </Accordion>,
  );

describe('Accordion', () => {
  it('renders the trigger collapsed by default', () => {
    renderAccordion();

    expect(
      screen.getByRole('button', { name: 'Is it accessible?' }).getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('expands the content when the trigger is activated', () => {
    renderAccordion();

    fireEvent.click(screen.getByRole('button', { name: 'Is it accessible?' }));

    expect(
      screen.getByRole('button', { name: 'Is it accessible?' }).getAttribute('aria-expanded'),
    ).toBe('true');
    screen.getByText('Yes, it follows WAI-ARIA patterns.');
  });
});
