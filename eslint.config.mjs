import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// Flat-config equivalent of the old .eslintrc.json
// ({ "extends": ["next/core-web-vitals", "next/typescript"] }).
export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // eslint-config-next 16 ships eslint-plugin-react-hooks 7, whose
    // recommended preset adds React Compiler diagnostics on top of
    // rules-of-hooks/exhaustive-deps. The app does not use the React Compiler,
    // and these flag long-standing, working patterns (e.g. resetting state in
    // an effect, react-hook-form's watch()). Rewriting those components is a
    // behaviour change outside a framework upgrade, so the rules that fire
    // are off for now; the rest of the new preset stays on.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
  ]),
])
