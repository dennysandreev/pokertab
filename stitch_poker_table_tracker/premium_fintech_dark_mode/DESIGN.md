---
name: Premium Fintech Dark Mode
colors:
  surface: '#141313'
  surface-dim: '#141313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353434'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffffff'
  on-tertiary: '#2f3131'
  tertiary-container: '#e2e2e2'
  on-tertiary-container: '#636565'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#141313'
  on-background: '#e5e2e1'
  surface-variant: '#353434'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  safe-area-inset: 16px
---

## Brand & Style

The brand personality is professional, analytical, and exclusive. This design system eschews the loud, neon-heavy tropes of online gambling in favor of a sophisticated fintech aesthetic. It targets serious players who view the game through the lens of performance, probability, and asset management.

The design style is **Minimalist-Glassmorphic**. It utilizes deep tonal layering to create a sense of focused calm. High-quality typography and generous whitespace ensure that complex data remains legible at a glance, while subtle glass effects provide a sense of modern depth suitable for a high-end Telegram Mini App experience.

## Colors

The palette is anchored by a "True Dark" foundation. By using #0F0F0F for the background and #1A1A1A for surfaces, we create a high-contrast environment that reduces eye strain during long sessions.

- **Primary:** Pure White (#FFFFFF) is reserved for high-priority headings and primary icons to ensure maximum "pop" against the dark background.
- **Secondary (Success):** Emerald Green (#10B981) signifies profit, positive equity, and active states.
- **Destructive:** Soft Red (#EF4444) is used sparingly for negative trends, losses, or critical "Fold/Exit" actions.
- **Tertiary:** Slate (#94A3B8) provides a sophisticated secondary tier for labels and supporting metadata.

## Typography

This system uses **Hanken Grotesk** for high-impact numeric and display data to project a modern fintech feel. **Inter** handles the functional body and UI labels for its world-class legibility in small-screen environments.

- **Scale:** Large headings are used to communicate bankroll totals or table stakes instantly.
- **Hierarchy:** Use `label-caps` in Slate (#94A3B8) for non-interactive metadata to keep the interface uncluttered.
- **Emphasis:** Numerical values representing currency should always use the medium or bold weights of Hanken Grotesk.

## Layout & Spacing

The layout follows a **Fluid Grid** model optimized for the Telegram Mini App viewport (390px-430px wide). 

- **Margins:** A standard 16px lateral margin (`md`) is applied to all main containers.
- **Gutter:** Use 12px (`sm`) between internal card elements.
- **Touch Targets:** All interactive elements maintain a minimum height of 48px.
- **Safe Areas:** Ensure bottom-fixed buttons account for the Telegram gesture bar by adding 24px of bottom padding.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Glassmorphism**. Shadows are avoided in favor of subtle border-strokes and opacity shifts.

1. **Level 0 (Background):** #0F0F0F.
2. **Level 1 (Cards):** #1A1A1A with a 1px solid border at 10% white opacity.
3. **Level 2 (Modals/Overlays):** A background blur (20px) with #1A1A1A at 80% opacity.
4. **Interactive State:** Hover or tap states should brighten the surface to #252525 rather than adding a shadow.

## Shapes

The system uses a **Rounded** philosophy to soften the "dark" aesthetic and make the app feel approachable yet premium.

- **Primary Cards:** 16px (`rounded-lg`) for all data containers.
- **Buttons:** 12px for standard buttons; 24px (`rounded-xl`) for main "Action" buttons to give them a distinct profile.
- **Input Fields:** 12px consistent with buttons.

## Components

### Buttons
- **Primary:** Emerald Green background with white text. High contrast for "Присоединиться", "Добавить ребай", or "Создать стол".
- **Secondary:** Dark grey (#252525) with white text. For "История", "Поделиться", or "К расчету".
- **Ghost:** No background, white or slate text. For "Назад" or "Отмена".

### Cards
Data visualization cards use a 1px border (#FFFFFF, 0.1 opacity) to define edges against the deep background. Key metrics (e.g., Win Rate, VPIP) are displayed in Hanken Grotesk with 12px slate labels above them.

### Input Fields
Filled style (#1A1A1A) with an active state border of Emerald Green. Use large, legible text for currency input.

### Chips
Used for table filters (e.g., "No Limit", "Pot Limit"). Chips use 16px height with #252525 backgrounds and 12px Inter medium text.

### Progress Bars
Thin, 4px height tracks. Background at 10% white, fill using Emerald Green for positive progress.
