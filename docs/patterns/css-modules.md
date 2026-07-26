# CSS Modules

Pathfinder authors component styling **only** with CSS Modules. No plain component CSS, no Tailwind, no CSS-in-JS, no static inline styles.

## Decision

- Every component gets its own `*.module.css` next to its `*.tsx`.
- The only global stylesheet is `app/globals.module.css`. It uses explicit `:global` selectors and `:root` tokens; it does not ship any class that is consumed by components.
- Tokens (colors, spacing, font sizes) live as CSS variables in `:root` inside `globals.module.css`. Components reference them via `var(--token)` so theming is centralised.
- Dynamic runtime values (computed colours, animated sizes) may use CSS variables or `data-*` attributes set inline, but the static base styles live in the module.
- Inline `style={{ ... }}` is forbidden for static values. Use the module. Inline `style` is allowed only for runtime-computed single values (`style={{ width: \`${ratio * cellSize}px\` }}`) when the alternative would be a class explosion.

## File layout

```text
components/Features/SubdivisionManager/
  SubdivisionManager.tsx
  SubdivisionManager.module.css

components/UI/Button/
  Button.tsx
  Button.module.css

app/globals.module.css      ← only global stylesheet
```

## Quick path (a button)

```css
/* components/UI/Button/Button.module.css */
.button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--fg);
  border-radius: 6px;
  cursor: pointer;
}

.button:hover {
  background: var(--bg);
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

```tsx
import styles from './Button.module.css';

export function Button({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={styles.button}>
      {children}
    </button>
  );
}
```

## Global stylesheet

`app/globals.module.css` is the **only** global-style entry. It carries:

- `:root` token block (colours, spacing, font sizes).
- A `:global { ... }` reset (`box-sizing: border-box`, `margin: 0`, etc.).
- Element selectors for `html`, `body`, `main` when needed.
- No class that components rely on.

```css
/* app/globals.module.css */
:root {
  --bg: #0d0e10;
  --bg-elevated: #16181c;
  --fg: #e6e7ea;
  --fg-muted: #8a8f99;
  --accent: #c9a86a;
  --border: #262a31;
  --grid: #2a2e36;
  --danger: #c44a4a;
  color-scheme: dark;
}

:global(*),
:global(*::before),
:global(*::after) {
  box-sizing: border-box;
}

:global(html),
:global(body) {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: ui-sans-serif, system-ui, sans-serif;
  min-height: 100vh;
}
```

## Dynamic runtime values

When a value depends on runtime state (e.g. a slider preview), use a CSS variable on the element and read it from the module:

```tsx
<input
  type="range"
  style={{ '--thumb-position': `${(value / max) * 100}%` } as React.CSSProperties}
/>
```

```css
.thumb {
  background: linear-gradient(
    to right,
    var(--accent) 0%,
    var(--accent) var(--thumb-position),
    var(--bg-elevated) var(--thumb-position)
  );
}
```

This keeps the dynamic value in one place and avoids generating a class per value.

## `data-*` for stateful variants

```tsx
<button data-active={isActive} className={styles.toggle} />
```

```css
.toggle[data-active='true'] {
  background: var(--accent);
  color: var(--bg);
}
```

## Rules

| Rule | Why |
|------|-----|
| One `*.module.css` per component | Local scope prevents leakage. |
| Tokens via `var(--...)` | Theming is centralised in `globals.module.css`. |
| No plain `.css` next to a component | Plain CSS leaks globally and collides. |
| No Tailwind, no CSS-in-JS | Reduces tooling surface area; Biome is the formatter. |
| No inline `style` for static values | Inline `style` is opaque to theming and linting. |
| Inline `style` for runtime-computed values is allowed | When class explosion is the only alternative. |
| `globals.module.css` is the only global entry | All element selectors and `:root` tokens live there. |

## Anti-patterns

- `className="form-field"` (plain CSS class) — use `className={styles.field}` and a module.
- `<button style={{ background: 'red' }}>` for a static colour — define a class.
- A `globals.css` that defines class names used by components. Move those to a module.
- Two modules redefining the same class (`.button`). Reuse one component instead.
- Using `@apply` or any other Tailwind-style layering.
- CSS-in-JS via `styled-components`, `emotion`, or inline object styles.

## CURRENT vs TARGET

The CURRENT tree has **plain CSS only** (`src/app/globals.css`, `home.css`, `editor.css`, `form.css`, `subdivision-manager.css`, `modal.css`, `gallery.css`, `weather.css`, `state-menu.css`). Migration to CSS Modules is part of the target refactor.

| CURRENT | TARGET |
|---------|--------|
| `src/app/globals.css` | `app/globals.module.css` (uses `:global` and `:root` tokens; no class names) |
| `src/app/home.css` | `app/page.module.css` |
| `src/app/editor/editor.css` | `app/editor/Editor.module.css` or per-component modules |
| `src/app/components/form/form.css` | split per primitive: `FormField.module.css`, `FormInput.module.css`, ... |
| `src/app/components/modal.css` | `components/UI/Modal/Modal.module.css` |
| `src/app/components/subdivision-manager.css` | `components/Features/SubdivisionManager/SubdivisionManager.module.css` |
| `src/canvas/weather/weather.css` | per-component modules under `src/canvas/weather/` |
| `src/canvas/traits/state-menu.css` | per-component module |

The current `:root { --bg, --grid ... }` token block is preserved as-is; only the file extension and the wrapper (`:global *` selectors) change. The `--grid` token currently lives in `src/app/globals.css` and is read by the canvas; the migration must carry it forward verbatim.

## Related

- [folder-architecture.md](../architecture/folder-architecture.md) — where each module lives.
- [code-style.md](./code-style.md) — naming for `*.module.css` files.