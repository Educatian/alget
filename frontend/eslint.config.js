import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    files: ['e2e/**/*.js', 'src/test/**/*.js', 'playwright.config.js'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  {
    files: [
      'src/components/BraggColorDesigner.jsx',
      'src/components/CapsuleHealingExplorer.jsx',
      'src/components/ConfidencePrompt.jsx',
      'src/components/PeelAsymmetryExplorer.jsx',
      'src/components/RelativeDensityExplorer.jsx',
      'src/components/SerrationOptimizer.jsx',
      'src/components/StackEffectDesigner.jsx',
    ],
    rules: {
      // These interactive labs intentionally export their pure physics models
      // alongside the React view so the same equations can be unit tested.
      'react-refresh/only-export-components': 'off',
    },
  },
])
