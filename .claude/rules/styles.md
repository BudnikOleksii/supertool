---
paths:
  - '**/*.scss'
  - '**/*.css'
---

# Styles Conventions

- Use SCSS modules: `ComponentName.module.scss` (PascalCase after the component, co-located with it)
- Class names in **camelCase**
- Style exclusively with the design tokens from `packages/ui/src/styles/tokens/` — semantic theme vars (`--primary`, `--on-surface`, `--surface-container`, `--outline-variant`, … from `theme.scss`, themed via `[data-theme]`), type scale (`--font-body-m-size`, … from `fonts.scss`), `--spacing-N`/`--radius-*` (`metrics.scss`), `--shadows-N` (`shadows.scss`). Never invent ad-hoc colors/sizes; extend the token files instead. `example/track-my-life/packages/ui/src/styles/` is the reference.
- Import mixins/breakpoints explicitly per file and use them namespaced: `@use "@supertool/ui/src/styles/mixins";` → `@include mixins.hover`, `@use "@supertool/ui/src/styles/breakpoints";` → `@include breakpoints.media-m` (inside `packages/ui` use relative paths, e.g. `@use "../../styles/mixins";`)
- Use mobile-first approach for responsive design. Write base styles for mobile, then add desktop overrides with media queries.
- When overriding `packages/ui` component styles, use double class selector

```scss
.customButton.customButton {
  background: red;
}
```

- Use CSS display properties with media queries for responsive element visibility:

```scss
.mobileButton.mobileButton {
  @include media-l {
    display: none;
  }
}

.desktopButton.desktopButton {
  display: none;

  @include media-l {
    display: block;
  }
}
```
