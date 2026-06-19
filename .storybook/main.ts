// DROP-452: Storybook 8 wiring para componentes del design system pastel.
//
// Activación:
//   npm install --save-dev @storybook/react-vite @storybook/addon-essentials
//                          @storybook/addon-a11y @storybook/addon-themes
//   npx storybook init --skip-install
//   npm run storybook
//
// La carpeta `src/components/**/*.stories.{ts,tsx}` se autoindexa.

import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
  ],
  framework: { name: '@storybook/react-vite', options: {} },
  docs: { autodocs: 'tag' },
}

export default config
