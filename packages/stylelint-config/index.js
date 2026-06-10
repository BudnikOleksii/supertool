const groups = require('./groups');

/** @type {import('stylelint').Config} */
module.exports = {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-standard-scss',
    '@stylistic/stylelint-config',
  ],
  plugins: [
    'stylelint-scss',
    'stylelint-order',
    'stylelint-declaration-block-no-ignored-properties',
  ],
  rules: {
    'color-named': 'never',
    'block-no-empty': true,
    'color-hex-length': 'long',
    'color-no-invalid-hex': true,
    'declaration-empty-line-before': null,
    'declaration-block-no-duplicate-properties': true,
    'media-feature-range-notation': 'prefix',
    'no-descending-specificity': null,
    'no-duplicate-selectors': null,
    'selector-pseudo-class-no-unknown': null,
    'declaration-property-value-no-unknown': null,
    'no-invalid-double-slash-comments': true,
    'value-keyword-case': null,
    'custom-property-empty-line-before': null,

    'property-no-unknown': [
      true,
      {
        ignoreProperties: ['composes', 'compose-with'],
      },
    ],

    'custom-property-pattern': [
      '^[a-z].*$',
      {
        message:
          'CSS variable names should be kebab-case with optional camelCase or underscore segments.',
      },
    ],

    'selector-class-pattern': [
      '^[a-z][a-zA-Z0-9]*$',
      {
        message: 'Class names should be in camelCase.',
      },
    ],

    'keyframes-name-pattern': [
      '^[a-z][a-zA-Z0-9]+$',
      {
        message: 'Keyframe names should be in camelCase.',
      },
    ],

    'scss/at-mixin-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',
      {
        message: 'Mixin names should be kebab-case (e.g., my-mixin, button-style).',
      },
    ],

    'scss/percent-placeholder-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',
      {
        message: 'Placeholder names should be kebab-case (e.g., my-placeholder, button-style).',
      },
    ],

    '@stylistic/indentation': 2,
    '@stylistic/string-quotes': 'double',
    '@stylistic/color-hex-case': 'lower',

    'plugin/declaration-block-no-ignored-properties': true,
    'order/properties-order': groups.map((group) => ({
      ...group,
      emptyLineBefore: 'always',
      noEmptyLineBetween: true,
    })),
  },
};
