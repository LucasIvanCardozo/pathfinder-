# Icons

Use FontAwesome icons from `@fortawesome/free-solid-svg-icons`. Never inline SVG.

## Decision

```tsx
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';

<FontAwesomeIcon icon={faEdit} />
<FontAwesomeIcon icon={faTrash} />
```

The `@fortawesome/react-fontawesome` and `@fortawesome/free-solid-svg-icons` packages are already present in `package.json` (user-owned change). Do not add other icon packages; if a needed icon is not in `free-solid-svg-icons`, add a wrapper in `components/UI/Icons/` rather than reaching for inline SVG or a new package.

## Quick path

1. Import the icon from `@fortawesome/free-solid-svg-icons` (e.g. `faPlus`, `faCheck`).
2. Render with `<FontAwesomeIcon icon={faPlus} />`.
3. For sizes/colors, use the `size` and `color` props or the surrounding CSS Module.

```tsx
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

<button type="button" className={styles.addButton}>
  <FontAwesomeIcon icon={faPlus} />
  Nuevo escenario
</button>
```

## Rules

| Rule | Why |
|------|-----|
| Import icons by name from `free-solid-svg-icons` | Tree-shakeable; small bundle. |
| Never inline `<svg>` markup | Inconsistent stroke widths, accessibility gaps. |
| Use `<FontAwesomeIcon>` with the imported icon object | Lets the bundler eliminate unused icons. |
| For icons not in the free-solid set, wrap once in `components/UI/Icons/` | Avoids per-call SVG sprawl. |
| Always provide a label for icon-only buttons | `aria-label` or visible text — accessibility. |

## Sizing and colour

```tsx
<FontAwesomeIcon icon={faTrash} size='sm' color='var(--danger)' />
```

Prefer CSS variables from `app/globals.module.css` for colour so theming stays centralized. Sizes should use the `size` prop (`"xs" | "sm" | "lg" | "xl"` etc.) so multiple icons share a visual rhythm.

## Anti-patterns

- Inline SVG paths from third-party sources. Wraps and steals focus incorrectly.
- Importing the entire library: `import * as icons from '@fortawesome/free-solid-svg-icons'`. Always import the named icon you need.
- Mixing emoji with FontAwesome in DOM nodes. Pick one.
- Adding new icon packages (`react-icons`, `lucide-react`, `heroicons`) without an explicit decision. Stick to FontAwesome.

## Konva canvas exception

Konva renderers (`src/canvas/components/**.tsx` that emit `<Layer>` / `<Group>`
etc.) render glyphs through `<Text>` directly onto the HTML5 canvas. FontAwesome
ships as SVG and is not addressable from Konva. Within those files, an emoji or
Unicode glyph (e.g. `🕓` for a clock-strikethrough vignette) is the legitimate
signal choice. The DOM above the canvas (popovers, tooltips, buttons) still
follows the FontAwesome-only rule.

## CURRENT vs TARGET

The CURRENT tree does not yet use FontAwesome. The `@fortawesome/react-fontawesome` and `@fortawesome/free-solid-svg-icons` packages are already declared in `package.json` (user-owned). When wiring icons, do not introduce inline SVG or new icon packages.

| CURRENT | TARGET |
|---------|--------|
| Plain text buttons like `+ Nuevo` | `<FontAwesomeIcon icon={faPlus} />` plus a label |
| Emoji or inline glyphs in the editor toolbar | `<FontAwesomeIcon>` per tool |
| `components/UI/Icons/` does not exist yet | Create as needed when free-solid lacks an icon |

## Related

- [code-style.md](./code-style.md) — Biome + naming.
- [css-modules.md](./css-modules.md) — styling icon-only buttons.