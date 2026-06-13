import type { Meta, StoryObj } from '@storybook/react-vite';

import { AspectRatio } from '@supertool/ui/src/components/atoms/aspect-ratio/AspectRatio';

const meta = {
  title: 'Primitives/AspectRatio',
  component: AspectRatio,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AspectRatio>;

export default meta;

type Story = StoryObj<typeof meta>;

const PLACEHOLDER_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  color: 'var(--on-secondary-container)',
  backgroundColor: 'var(--secondary-container)',
  fontFamily: 'var(--default-font-family)',
};

export const Widescreen: Story = {
  render: (args) => (
    <div style={{ width: 320 }}>
      <AspectRatio {...args}>
        <div style={PLACEHOLDER_STYLE}>16 / 9</div>
      </AspectRatio>
    </div>
  ),
};

export const Square: Story = {
  args: { ratio: 1 },
  render: (args) => (
    <div style={{ width: 200 }}>
      <AspectRatio {...args}>
        <div style={PLACEHOLDER_STYLE}>1 / 1</div>
      </AspectRatio>
    </div>
  ),
};
