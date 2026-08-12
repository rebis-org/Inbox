/* eslint-disable antfu/no-top-level-await */
import type { Linter } from 'eslint';
import { ignores, sukka } from 'eslint-config-sukka';

const configs = await sukka({
  js: true,
  ts: true,
  react: true,
  json: true,
  node: true,
  stylistic: true
});

configs.push({
  files: [
    'app/routes/**/*.tsx',
    'app/components/**/*.tsx',
    'app/hooks/*.ts'
  ],
  rules: {
    'sukka/unicorn/filename-case': 'off',
    'react-refresh/only-export-components': 'off',
    'no-restricted-syntax': 'off'
  }
}, {
  files: ['app/components/ui/**/*.tsx'],
  rules: {
    'react-refresh/only-export-components': 'off'
  }
}, {
  files: ['app/components/RichTextEditor.tsx'],
  rules: {
    'react-prefer-function-component/react-prefer-function-component': 'off',
    '@typescript-eslint/class-methods-use-this': 'off'
  }
}, {
  files: ['app/queries/**', 'app/routes/**'],
  rules: {
    'no-restricted-imports': 'off'
  }
}, {
  rules: {
    'vibe-proof/ban-eslint-disable': 'off'
  }
});

for (let i = 0, len = configs.length; i < len; i++) {
  const config = configs[i];
  if (config.rules?.['import-x/no-unresolved'] !== undefined) {
    config.rules['import-x/no-unresolved'] = [
      'error',
      { ignore: ['cloudflare:workers'] }
    ];
  }
  if (config.rules?.['sukka/prefer-foxts-error-util'] !== undefined) {
    config.rules['sukka/prefer-foxts-error-util'] = 'off';
  }
  if (config.rules?.['sukka/prefer-slice-over-split-index'] !== undefined) {
    config.rules['sukka/prefer-slice-over-split-index'] = 'off';
  }
  if (config.rules?.['sukka/unicorn/custom-error-definition'] !== undefined) {
    config.rules['sukka/unicorn/custom-error-definition'] = 'off';
  }
  if (
    config.rules?.['sukka/unicorn/no-declarations-before-early-exit']
    !== undefined
  ) {
    config.rules['sukka/unicorn/no-declarations-before-early-exit'] = 'off';
  }
}

const resolvedConfig: Linter.Config[] = [
  ...ignores({
    gitignore: true,
    customGlobs: [
      'app/routeTree.gen.ts',
      'worker-configuration.d.ts',
      '**/.wrangler/**',
      'dist/**',
      'build/**'
    ]
  }),
  ...configs
];

export default resolvedConfig;
