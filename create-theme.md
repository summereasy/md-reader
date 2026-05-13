# Create Theme

You are helping add a new color theme to the md-reader Chrome extension.

The user will provide a color palette — it may be an image file, a markdown/text file, or a hex color list. Read or view it first, then implement the theme end-to-end.

---

## How the theme system works

### User-facing model

- **Appearance** (Light / Dark / Auto) — `ColorMode` — controls which branch is active
- **Light theme** dropdown — `LightTheme` — picks the specific light variant (e.g. Default, Claude)
- **Dark theme** dropdown — `DarkTheme` — picks the specific dark variant (e.g. Default, Nordic)

### Runtime resolution (`resolveTheme` in `src/content/renderer-entry.ts`)

```
colorMode=light  + lightTheme=default  →  data-mdr-theme="light"   (base :root styles)
colorMode=light  + lightTheme=claude   →  data-mdr-theme="claude"
colorMode=dark   + darkTheme=default   →  data-mdr-theme="dark"
colorMode=dark   + darkTheme=nordic    →  data-mdr-theme="nordic"
colorMode=auto   → follows system preference, then applies lightTheme or darkTheme accordingly
```

The function is generic: `default` maps to the base theme name (`light`/`dark`), any other value is passed through as-is. **No changes needed to `resolveTheme` when adding a new theme.**

### CSS selector

Each theme is a CSS block in `src/content/style.css`:

```css
[data-mdr-theme="<theme-name>"] {
  /* override variables here */
}
```

The base light theme lives in `:root`. Only override what differs from `:root` for light variants, or provide a full set for dark variants.

---

## What to implement

Ask the user: **is this a light theme or a dark theme?** (if not obvious from the palette). Also confirm the desired theme name (kebab-case, e.g. `solarized`, `rose-pine`).

### Step 1 — `src/shared/types.ts`

Add the theme name to the correct union type and its display entry in the matching constant:

```ts
// For a light theme:
export type LightTheme = 'default' | 'claude' | '<new-name>'
export const LIGHT_THEMES = [
  { value: 'default', label: 'Default' },
  { value: 'claude',  label: 'Claude'  },
  { value: '<new-name>', label: '<Display Name>' },
]

// For a dark theme:
export type DarkTheme = 'default' | 'nordic' | '<new-name>'
export const DARK_THEMES = [
  { value: 'default',    label: 'Default' },
  { value: 'nordic',     label: 'Nordic'  },
  { value: '<new-name>', label: '<Display Name>' },
]
```

That's the only logic change needed — the dropdown UIs (popup, options page, options menu) all auto-generate from these constants.

### Step 2 — `src/content/style.css`

Add a CSS block after the existing theme blocks (after `nordic`, before `/* Base */`).

Map the palette colors to these variables. All variables below should be set:

```css
[data-mdr-theme="<new-name>"] {
  /* Color primitives — used via semantic aliases below */
  --mdr-red: ;
  --mdr-orange: ;
  --mdr-yellow: ;
  --mdr-green: ;
  --mdr-cyan: ;
  --mdr-blue: ;
  --mdr-magenta: ;

  /* Surface & text */
  --mdr-bg: ;               /* page background */
  --mdr-text: ;             /* body text */
  --mdr-text-secondary: ;   /* subtitles, captions */
  --mdr-border: ;           /* dividers, input borders */

  /* Component backgrounds */
  --mdr-code-bg: ;          /* inline code */
  --mdr-pre-bg: ;           /* code block background */
  --mdr-side-bg: ;          /* sidebar / file tree */

  /* Links */
  --mdr-link: var(--mdr-primary);
  --mdr-link-hover: ;

  /* Typography */
  --mdr-heading: ;
  --mdr-blockquote-text: ;
  --mdr-blockquote-border: ;
  --mdr-blockquote-bg: ;

  /* Tables */
  --mdr-table-border: ;
  --mdr-table-head: ;       /* header cell background */
  --mdr-table-stripe: ;     /* alternating row */

  /* Misc */
  --mdr-mark: ;             /* <mark> highlight — use color-mix() */
  --mdr-hr: ;               /* horizontal rule */

  /* Buttons (copy button, etc.) */
  --mdr-btn-bg: ;
  --mdr-btn-hover: ;
  --mdr-btn-color: ;

  /* Options menu overlay */
  --mdr-menu-bg: ;          /* rgba, semi-transparent */

  /* Contrast */
  --mdr-mark-text: ;        /* text on mark highlight */
  --mdr-on-accent: ;        /* text on primary-colored backgrounds */

  /* Semantic aliases */
  --mdr-soft-alpha: 12%;    /* adjust if needed (10–18%) */
  --mdr-primary: var(--mdr-blue);    /* or whichever color fits best */
  --mdr-important: var(--mdr-magenta);
  --mdr-success: var(--mdr-green);
  --mdr-warning: var(--mdr-yellow);
  --mdr-danger: var(--mdr-red);

  /* Scrollbar */
  --mdr-scrollbar-thumb: ;
  --mdr-scrollbar-thumb-hover: ;
  --mdr-scrollbar-track: transparent;

  /* Highlight.js syntax colors */
  --hljs-base: ;            /* same as --mdr-pre-bg */
  --hljs-mono-1: ;          /* primary text */
  --hljs-mono-2: ;          /* comments, faded */
  --hljs-mono-3: ;          /* even more faded */
  --hljs-hue-1: ;           /* cyan — keywords */
  --hljs-hue-2: ;           /* blue — functions */
  --hljs-hue-3: ;           /* purple/magenta — types */
  --hljs-hue-4: ;           /* green — strings */
  --hljs-hue-5: ;           /* red — errors/tags */
  --hljs-hue-5-2: ;         /* dark red */
  --hljs-hue-6: ;           /* orange — numbers */
  --hljs-hue-6-2: ;         /* yellow — attributes */
}
```

**Color mapping tips:**
- `--mdr-primary` sets link color, active UI accents, and the options menu highlight — pick the most characteristic color of the palette
- `--mdr-pre-bg` should be slightly darker/lighter than `--mdr-bg` for contrast
- `--mdr-side-bg` should be noticeably distinct from `--mdr-bg`
- For `--mdr-menu-bg` use `rgba()` with 0.92–0.95 alpha for a frosted effect
- `--mdr-mark` typically uses `color-mix(in srgb, var(--mdr-yellow) 55-78%, var(--mdr-bg))`
- Scrollbar thumb: use text color at ~20–25% alpha

### Step 3 — Build & verify

```bash
npm run build
```

Fix any TypeScript errors (usually just the union type). No other files need touching.

---

## Reference: existing themes

| Theme | Type | Key colors |
|-------|------|-----------|
| `light` (Default) | light | white bg, blue primary |
| `claude` | light | oat `#E3DACC` bg, clay `#D97757` primary |
| `dark` (Default) | dark | near-black bg, blue primary |
| `nordic` | dark | Nord palette, cyan primary |

Inspect `src/content/style.css` for the full variable values of any existing theme if you need reference values.
