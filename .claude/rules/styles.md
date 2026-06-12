---
paths:
  - '**/*.scss'
  - '**/*.css'
---

# Styles Conventions

- Use SCSS modules: `component-name.module.scss` (kebab-case, co-located with the component)
- Class names in **camelCase**
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
