import '@supertool/ui/src/styles/index.scss';
import type { Preview } from '@storybook/react-vite';
import type { ComponentType } from 'react';
import type { StoryContext } from 'storybook/internal/csf';

import { DecoratorHelpers, withThemeByDataAttribute } from '@storybook/addon-themes';
import { ThemeProvider } from 'next-themes';
import { createElement } from 'react';

const { pluckThemeFromContext } = DecoratorHelpers;

const withDataTheme = withThemeByDataAttribute({
  themes: {
    light: 'light',
    dark: 'dark',
  },
  defaultTheme: 'light',
  attributeName: 'data-theme',
});

const withNextThemes: Preview['decorators'] = [
  (Story: ComponentType, context: StoryContext) => {
    const theme = pluckThemeFromContext(context) || 'light';

    return createElement(
      ThemeProvider,
      {
        attribute: 'data-theme',
        defaultTheme: 'light',
        forcedTheme: theme,
        enableSystem: false,
      },
      createElement(Story),
    );
  },
];

const preview: Preview = {
  decorators: [withDataTheme, ...withNextThemes],
  parameters: {
    layout: 'centered',
    a11y: {
      test: 'error',
    },
  },
};

export default preview;
