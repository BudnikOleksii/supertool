import '@supertool/ui/src/styles/index.scss';
import type { Preview } from '@storybook/react-vite';

document.documentElement.dataset['theme'] = 'light';

const preview: Preview = {
  parameters: {
    layout: 'centered',
  },
};

export default preview;
