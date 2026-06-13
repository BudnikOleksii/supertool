import type { Meta, StoryObj } from '@storybook/react-vite';

import { screen, userEvent, within } from 'storybook/test';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@supertool/ui/src/components/molecules/accordion/Accordion';

const meta = {
  title: 'Primitives/Accordion',
  component: Accordion,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { type: 'single' },
} satisfies Meta<typeof Accordion>;

export default meta;

type Story = StoryObj<typeof meta>;

const AccordionDemo = () => (
  <Accordion type="single" collapsible style={{ width: 360 }}>
    <AccordionItem value="overview">
      <AccordionTrigger>What is supertool?</AccordionTrigger>
      <AccordionContent>A personal tool platform built on a shared shell.</AccordionContent>
    </AccordionItem>
    <AccordionItem value="accessibility">
      <AccordionTrigger>Is it accessible?</AccordionTrigger>
      <AccordionContent>Yes. It follows the WAI-ARIA accordion design pattern.</AccordionContent>
    </AccordionItem>
    <AccordionItem value="theming">
      <AccordionTrigger>Does it support dark mode?</AccordionTrigger>
      <AccordionContent>Every surface is driven by the shared design tokens.</AccordionContent>
    </AccordionItem>
  </Accordion>
);

export const Default: Story = {
  render: () => <AccordionDemo />,
};

export const Open: Story = {
  render: () => <AccordionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'What is supertool?' }));
    await screen.findByText('A personal tool platform built on a shared shell.');
  },
};
