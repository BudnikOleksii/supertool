---
paths:
  - '**/*.tsx'
  - '**/*.jsx'
---

## Component Architecture

- Favor React Server Components (RSC) where possible
- Minimize 'use client' directives
- Implement proper error boundaries
- Use Suspense for async operations
- Optimize for performance and Web Vitals (LCP, CLS, FID)

## RSC Data Fetching

- Fetch data in async server components, pass to client components as props
- Use async server wrapper components (e.g., `TransactionListServer`) that fetch data and render the corresponding client component
- Wrap each server wrapper in its own `<Suspense>` boundary with a skeleton fallback for independent streaming
- Use a `key` prop on `<Suspense>` derived from filters/searchParams to reset boundaries on filter changes
- Extract Suspense fallback JSX into module-level constants to satisfy `jsx-no-jsx-as-prop` lint rule
- Read `searchParams` in `page.tsx` (server), parse with a `parse*SearchParams` helper, pass to server wrappers
- Read functions (`fetch*`) are plain async functions (no `'use server'`), importable by server components. Use `rsc-api.ts` service instances
- Mutation functions (`create*`, `update*`, `delete*`) remain as server actions (`'use server'`), use `server-api.ts` service instances
- After mutations, rely on `revalidatePath` for data refresh — do NOT duplicate server-fetched data in client state
- Client hooks should only manage UI state (dialog open/close, editing entity) — never list data that comes from the server

## React Conventions

- Type every component as `FC<Props>`: `export const Button: FC<ButtonProps> = ({ ... }) => ...` — never bare `(props: ButtonProps)` parameter typing. Use `PropsWithChildren` for components accepting children.
- Before building a component or feature, check `example/track-my-life` for its counterpart and use it as the pattern reference (adapted to supertool conventions — never copy or import from `example/`).
- Use all simple UI components (Typography, Button, Input, etc.) from `packages/ui`.
- Use `NavigationLink` from `packages/next-shared/src/i18n/navigation/NavigationLink.tsx` instead of Next.js default `Link` for navigation links that need active state tracking.
- Use `redirect`, `usePathname`, `useRouter` from `packages/next-shared/src/i18n/navigation/navigation.ts` instead of Next.js default `next/link` and `next/navigation` to ensure proper i18n routing.
- Use the `cn` utility from `packages/ui/src/lib/utils.ts` for conditional class composition instead of ternary operators or string concatenation.

## State Management

- Use `useActionState` instead of deprecated `useFormState`
- Leverage enhanced `useFormStatus` with new properties (data, method, action)
- Use URL searchParams for filter/pagination state — update via `router.replace` to trigger server re-renders
- Minimize client-side state: dialog open/close and editing entity only, never list data

## Async Request APIs

```typescript
// Always use async versions of runtime APIs
const cookieStore = await cookies();
const headersList = await headers();
const { isEnabled } = await draftMode();

// Handle async params in layouts/pages
const params = await props.params;
const searchParams = await props.searchParams;
```

## Props

- Prefix callback props with `on` (e.g., `onSubmit`, `onClick`).
- Prefix handler functions with `handle` (e.g., `handleSubmit`, `handleClick`).
- Always use curly braces for handler bodies, no implicit returns.
- Omit curly braces for string literal props.

## Component Structure

```text
my-component/
├── MyComponent.tsx       # PascalCase component file exporting `MyComponent`
├── types.ts              # Shared types (optional)
├── constants.ts          # Component constants (optional)
├── hooks/                # Component-specific hooks (optional)
└── components/           # Child components (optional)
```
