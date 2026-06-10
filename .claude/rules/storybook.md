---
paths:
  - apps/storybook/**
  - packages/ui/src/components/**
---

# Storybook

When a component is added to `packages/ui`, add a corresponding story in `apps/storybook/src/stories/`. Follow CSF3 format with `Meta`, `StoryObj`, `tags: ['autodocs']`, and `parameters: { layout: 'centered' }`. Use `useState` wrapper components for interactive stories.
