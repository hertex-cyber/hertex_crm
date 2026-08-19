# Hertex Cultivate Design Architecture

> **Purpose:** This file is the canonical design reference for future Hertex Cultivate frontend work. Read it before changing authentication screens, shared layouts, colors, typography, or interaction styling. Where this document conflicts with an older component style, this document takes precedence unless the product owner specifies otherwise.

## 1. Design Intent

Hertex Cultivate should feel **calm, considered, human, and capable**. The visual language is editorial rather than corporate-technical: warm off-white surfaces, restrained natural color, and a modern serif used selectively for meaningful hierarchy. The product must still feel operationally clear and professional, especially within CRM workflows.

The approved authentication direction uses a soft, light earth-tone environment rather than the former dark navy interface. It is not rustic, distressed, overly decorative, or nostalgic. Space, clean typography, and subtle tonal depth should carry the experience.

| Principle | Practical interpretation |
|---|---|
| **Warm clarity** | Use parchment, cream, olive, and espresso with generous whitespace. Avoid cold grayscale-heavy screens. |
| **Editorial confidence** | Use the display serif for key headings only; keep UI labels, forms, and data interfaces sans-serif. |
| **Low-noise focus** | Prefer subtle shadows, thin borders, and one primary action per form. Do not compete with the task. |
| **Cultivation motif** | Use organic muted green as a measured accent for emphasis, confirmations, and highlighted phrases—not as a dominant surface. |
| **Accessible restraint** | Retain contrast, focus indication, understandable labels, and touch targets even when styling is minimal. |

## 2. Approved Authentication Composition

The authentication experience is a responsive two-column composition.

| Area | Desktop behavior | Mobile behavior |
|---|---|---|
| **Left narrative panel** | Visible from the `md` breakpoint. It contains the Hertex Cultivate mark, a short value proposition, and three concise feature statements. | Hidden to prioritize the account form. The compact brand mark remains above the form. |
| **Background** | Soft layered radial gradients in olive and warm sand over a cream base. | The same atmosphere can remain, but must not reduce form contrast. |
| **Right form panel** | A centered, narrow form card, up to approximately `420px` wide. | Full-width within appropriate page padding. |
| **Form card** | Cream-white, rounded, lightly elevated, and quiet. | Same styling; spacing can tighten slightly. |

The authentication screens should preserve the current flow and routes:

| Route | Primary intent | Required elements |
|---|---|---|
| `/login` | Existing user sign-in | Email, password, password visibility control, password recovery, sign-in button, Google option, registration route. |
| `/register` | New user registration | First name, last name, email, password, password visibility control, terms agreement, create-account button, Google option, login route. |

## 3. Color System

Use the following palette for all new authentication work. Do not reintroduce the former orange CTA palette or blue-heavy CRM landing styles into these screens.

| Token | Value | Approved usage |
|---|---:|---|
| `--surface-page` | `#F5F0E7` | Primary page base. |
| `--surface-page-soft` | `#FAF8F4` | Lower page gradient and secondary light areas. |
| `--surface-card` | `#FFFDF8` | Form card and elevated light surfaces. |
| `--ink` | `#38291F` | Main display text and high-emphasis copy. |
| `--ink-soft` | `#554437` | Secondary strong text and outline button text. |
| `--text-muted` | `#756555` | Supporting copy, descriptions, and muted labels. |
| `--accent-olive` | `#5F725D` | Highlighted text, active checks, secondary links, and success-adjacent emphasis. |
| `--accent-olive-soft` | `#99AB91` | Ambient gradient support only. |
| `--action-espresso` | `#49362A` | Primary CTA background. |
| `--action-espresso-hover` | `#35251C` | Primary CTA hover. |
| `--border-warm` | `#D7C9B6` | Input, outline-button, and muted control borders. |
| `--border-subtle` | `#E4D9C9` | Dividers and low-emphasis separation. |
| `--icon-muted` | `#A59480` | Form-field leading icons and noninteractive secondary symbols. |

### Color Rules

Use **espresso** for primary actions only. Use **olive** for supporting emphasis such as inline links and select highlighted words; it should not become a second competing primary button. Avoid pure black, pure white, saturated orange, saturated blue, and large solid green blocks.

The main background should be built from layered, low-opacity radial gradients. The gradients are ambient and must never obscure content or make input borders difficult to see.

```css
background:
  radial-gradient(ellipse 72% 58% at 42% 10%, rgba(196, 205, 181, 0.55) 0%, rgba(226, 222, 202, 0.34) 42%, transparent 72%),
  radial-gradient(ellipse 45% 52% at 95% 5%, rgba(225, 203, 169, 0.38) 0%, transparent 70%),
  linear-gradient(180deg, #F5F0E7 0%, #FAF8F4 64%, #F7F5F1 100%);
```

## 4. Typography

The approved type pairing is **DM Serif Display** for display hierarchy and **Inter/DM Sans** for the interface. The font is loaded in `frontend/index.html`.

| Role | Font stack | Weight | Usage |
|---|---|---:|---|
| Display heading | `"DM Serif Display", Georgia, serif` | `400` | Hero statement and authentication form title. |
| Brand wordmark | `"DM Serif Display", Georgia, serif` | `700` | Small uppercase wordmark only. |
| Interface text | `"DM Sans", "Inter", sans-serif` | `400–700` | Inputs, buttons, body copy, labels, tables, navigation, metadata. |

### Type Scale

Typography must be deliberate but compact enough for the form to breathe.

| Element | Desktop size | Mobile size | Notes |
|---|---:|---:|---|
| Narrative hero | `2.85rem` max | Hidden on small screens | Use `line-height: 1.05` and a modest negative tracking value. |
| Authentication form title | `1.85rem` max | `1.65rem` | Keep content concise; avoid multi-sentence headings. |
| Brand wordmark | `1.05rem` | `1.05rem` | Uppercase; do not enlarge. |
| Supporting copy | `0.85–1rem` | `0.82–0.95rem` | Use muted ink and comfortable line height. |
| Labels and controls | `0.82–0.95rem` | same | Always prioritize readability over decorative typography. |

**Never use Times New Roman** as a deliberate display choice. It may remain only as a browser-level last-resort serif fallback after DM Serif Display and Georgia.

## 5. Form and Component Rules

Forms should be quiet and unmistakable. Inputs must retain labels where present, sensible placeholders, keyboard focus visibility, error messages, and disabled/loading states.

| Component | Required styling |
|---|---|
| **Text fields** | Cream-white or transparent light field surface, warm border, muted warm icon, clear focus treatment, `border-radius` around `8–12px`. |
| **Primary button** | Espresso fill, cream text, rounded corners, modest shadow, a fast hover lift, and a small active press scale. |
| **Secondary / OAuth button** | Cream surface, warm outline border, espresso text, no excessive shadow. |
| **Checkbox** | Warm neutral default with olive checked state. |
| **Divider** | Thin `--border-subtle` rule with understated uppercase label where needed. |
| **Inline link** | Olive text with strong enough weight to be recognizable. Do not use browser-blue defaults. |
| **Error alert** | Use the existing accessible alert component; retain explicit written error messages. |

### Interaction Motion

Motion must be subtle and functional. Use only `transform`, `opacity`, `background-color`, and `box-shadow` transitions. Primary actions may lift by `1px` on hover and compress to approximately `scale(0.98)` while active. Standard interaction duration is `160ms` with a snappy ease-out curve.

```css
transition:
  transform 160ms cubic-bezier(0.23, 1, 0.32, 1),
  box-shadow 160ms cubic-bezier(0.23, 1, 0.32, 1),
  background-color 160ms cubic-bezier(0.23, 1, 0.32, 1);
```

Respect `prefers-reduced-motion`; no critical interaction may depend on animation.

## 6. Content and Layout Guardrails

The current approved copy intentionally keeps the registration form concise.

| Screen | Approved form heading | Do not add without approval |
|---|---|---|
| Login | `Welcome back, sign in` | Multiple marketing paragraphs inside the form card. |
| Register | `Create your account` | `, start growing` and `Bring your customer relationships into sharper focus.` |

The broader brand narrative belongs in the desktop-only left panel. Do not duplicate it inside the registration card. Keep form-card titles direct and task-specific.

Avoid the following patterns unless explicitly requested:

- A generic centered card on a flat gray background.
- More than one strong CTA in the same form area.
- Icon-heavy decoration or logo walls on authentication routes.
- Excessively rounded “pill” input fields.
- Large display headings that push form fields below the initial viewport.
- Dark-dashboard colors on the approved light authentication pages.

## 7. Implementation Map

Use this table to find the appropriate file before changing a related visual element.

| Responsibility | Repository file |
|---|---|
| Shared authentication background, responsive two-column layout, theme, hero narrative | `frontend/src/components/layout/AuthLayout.tsx` |
| Sign-in fields, sign-in action, login-specific header | `frontend/src/features/auth/LoginPage.tsx` |
| Registration fields, agreement control, sign-up-specific header | `frontend/src/features/auth/RegisterPage.tsx` |
| Web font loading and document-level metadata | `frontend/index.html` |
| Authenticated CRM visual system | Follow the relevant feature/layout files; do not automatically copy authentication styles into dense data screens. |

## 8. Agent Working Protocol

When an agent receives a request to design or alter a Hertex UI, it should apply the following decision process.

1. **Read this document first.** Confirm whether the work is authentication, a data-dense CRM module, or a public marketing surface.
2. **Preserve behavior.** Do not alter routing, API calls, validation, field names, role logic, or accessibility semantics merely to restyle a page.
3. **Reuse tokens.** Use the palette and typography rules above instead of inventing new close-but-inconsistent shades and font stacks.
4. **Maintain page purpose.** Authentication screens remain light and editorial. CRM data screens may be denser and may need a separate documented pattern before inheriting this entire composition.
5. **Verify at two sizes.** Check a desktop viewport and a mobile viewport after visual changes. Ensure the form stays usable, focused controls are visible, and copy does not overflow.
6. **Avoid unauthorized visual drift.** Do not return to Times New Roman, generic sans-only display headings, orange calls-to-action, or high-saturation blue accents on the authentication pages without explicit user direction.
7. **Document material additions.** If a new recurring component or a new visual token is accepted, extend this file in the relevant section before considering the task complete.

## 9. Future Extension Guidance

This document currently governs the authentication experience. It should guide the broader product’s tone, but the CRM dashboard will require an additional data-interface architecture that defines tables, charts, sidebars, filters, status colors, and dense responsive states. Create that companion reference before applying the authentication page layout wholesale to CRM modules.

When in doubt, prioritize **readability, calm hierarchy, warm restraint, and real task completion** over decorative novelty.
