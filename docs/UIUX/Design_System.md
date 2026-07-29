# Design System — MUI 5 Theme Configuration

## Color Palette

### Primary Colors
```typescript
const primary = {
  50:  '#e3f2fd',
  100: '#bbdefb',
  200: '#90caf9',
  300: '#64b5f6',
  400: '#42a5f5',
  500: '#1976D2',  // Primary main
  600: '#1565c0',
  700: '#0d47a1',  // Primary dark
  800: '#0a3d91',
  900: '#072a61',
};

const secondary = {
  50:  '#f3e5f5',
  100: '#e1bee7',
  200: '#ce93d8',
  300: '#ba68c8',
  400: '#ab47bc',
  500: '#7B1FA2',  // Secondary main
  600: '#6a1b9a',
  700: '#4a148c',
  800: '#38006b',
  900: '#25004a',
};
```

### Semantic Colors
```typescript
const success = {
  main: '#2E7D32',
  light: '#4CAF50',
  dark: '#1B5E20',
  bg: '#E8F5E9',
};

const warning = {
  main: '#ED6C02',
  light: '#FF9800',
  dark: '#E65100',
  bg: '#FFF3E0',
};

const error = {
  main: '#D32F2F',
  light: '#EF5350',
  dark: '#C62828',
  bg: '#FFEBEE',
};

const info = {
  main: '#0288D1',
  light: '#03A9F4',
  dark: '#01579B',
  bg: '#E1F5FE',
};
```

### Neutral Colors
```typescript
const neutral = {
  0:    '#FFFFFF',
  50:   '#FAFAFA',
  100:  '#F5F5F5',
  200:  '#EEEEEE',
  300:  '#E0E0E0',
  400:  '#BDBDBD',
  500:  '#9E9E9E',
  600:  '#757575',
  700:  '#616161',
  800:  '#424242',
  900:  '#212121',
  1000: '#121212', // Dark mode background
};
```

### Lead Rating Colors
```typescript
const leadRating = {
  hot:   '#D32F2F',
  warm:  '#ED6C02',
  cold:  '#1976D2',
};
```

### Status Colors
```typescript
const statusColors = {
  NEW:         neutral[500],
  CONTACTED:   info.main,
  QUALIFIED:   success.main,
  DISQUALIFIED: warning.main,
  CONVERTED:   '#6A1B9A',
  JUNK:        error.main,
  WON:         success.main,
  LOST:        error.main,
};
```

## Typography

### Font Family
```typescript
const typography = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace: '"JetBrains Mono", "Fira Code", "Roboto Mono", monospace',
};
```

### Type Scale
```typescript
const typeScale = {
  h1: {
    fontSize: '2.25rem',    // 36px
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  h2: {
    fontSize: '1.875rem',   // 30px
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
  },
  h3: {
    fontSize: '1.5rem',     // 24px
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: '-0.01em',
  },
  h4: {
    fontSize: '1.25rem',    // 20px
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '0em',
  },
  h5: {
    fontSize: '1.125rem',   // 18px
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h6: {
    fontSize: '1rem',       // 16px
    fontWeight: 600,
    lineHeight: 1.5,
  },
  body1: {
    fontSize: '1rem',       // 16px
    fontWeight: 400,
    lineHeight: 1.5,
  },
  body2: {
    fontSize: '0.875rem',   // 14px
    fontWeight: 400,
    lineHeight: 1.5,
  },
  caption: {
    fontSize: '0.75rem',    // 12px
    fontWeight: 400,
    lineHeight: 1.5,
  },
  overline: {
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 2,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  // Data table specific
  dataCell: {
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.5,
    fontFeatureSettings: '"tnum"',  // Tabular numbers
  },
  dataHeader: {
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.5,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
};
```

## Spacing

### Baseline Grid: 4px

```typescript
const spacing = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128];
// spacing[0]=0, [1]=4, [2]=8, [3]=12, [4]=16, [5]=20, [6]=24, [7]=32, [8]=40, etc.
```

### Common Spacing Values
| Token | Pixels | Usage |
|-------|--------|-------|
| `space-1` | 4px | Icons, small gaps |
| `space-2` | 8px | Input padding, chip gaps |
| `space-3` | 12px | Card padding (dense) |
| `space-4` | 16px | Card padding (default) |
| `space-5` | 20px | Section gaps |
| `space-6` | 24px | Page margins, modal padding |
| `space-8` | 32px | Section margins |
| `space-12` | 48px | Page section spacing |

## Elevation (Shadows)

```typescript
const shadows = {
  none: 'none',
  sm:   '0px 1px 2px rgba(0,0,0,0.06), 0px 1px 3px rgba(0,0,0,0.1)',
  md:   '0px 2px 4px rgba(0,0,0,0.06), 0px 4px 6px rgba(0,0,0,0.1)',
  lg:   '0px 4px 8px rgba(0,0,0,0.06), 0px 8px 16px rgba(0,0,0,0.1)',
  xl:   '0px 8px 16px rgba(0,0,0,0.06), 0px 16px 32px rgba(0,0,0,0.1)',
  // MUI default elevation 1-24, customized:
  drawer: '16px 0 24px rgba(0,0,0,0.08)',
  modal:  '0px 24px 48px rgba(0,0,0,0.2)',
  sticky: '0px 2px 8px rgba(0,0,0,0.08)',
};
```

### Elevation Levels
| Level | Component | Shadow |
|-------|-----------|--------|
| 0 | Page background | none |
| 1 | Card, Table row | sm |
| 2 | Dropdown, Popover | md |
| 3 | Sticky header, Nav | lg |
| 4 | Sidebar, Drawer | drawer |
| 5 | Modal, Dialog | modal |
| 6 | Tooltip, Snackbar | xl |

## Icons

- **Library:** Material Icons (outlined style preferred)
- **Size:** 20px (sm), 24px (md), 32px (lg)
- **Custom icons:** SVG sprite for brand-specific icons (TZAHU logo, module icons)
- **Status icons:** Consistent set (check=Success, warning=Warning, x=Error, i=Info)

## Motion

```typescript
const transitions = {
  duration: {
    instant: 100,  // Hover, micro-interactions
    fast:    200,  // Button click, toggle
    normal:  300,  // Page transitions, drawer
    slow:    400,  // Modals, complex animations
  },
  easing: {
    default:  'cubic-bezier(0.4, 0, 0.2, 1)',   // Standard
    enter:    'cubic-bezier(0.0, 0, 0.2, 1)',   // Elements entering
    exit:     'cubic-bezier(0.4, 0, 1.0, 1)',    // Elements leaving
    sharp:    'cubic-bezier(0.4, 0, 0.6, 1)',    // Temporary elements
  },
};
```

## MUI 5 Theme Configuration

```typescript
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#1976D2', light: '#42a5f5', dark: '#0d47a1' },
    secondary: { main: '#7B1FA2', light: '#ba68c8', dark: '#4a148c' },
    success: { main: '#2E7D32', light: '#4CAF50', dark: '#1B5E20' },
    warning: { main: '#ED6C02', light: '#FF9800', dark: '#E65100' },
    error: { main: '#D32F2F', light: '#EF5350', dark: '#C62828' },
    info: { main: '#0288D1', light: '#03A9F4', dark: '#01579B' },
    background: { default: '#FAFAFA', paper: '#FFFFFF' },
    text: { primary: '#212121', secondary: '#757575', disabled: '#9E9E9E' },
    divider: '#E0E0E0',
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.01em' },
    h3: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.35 },
    h4: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
    h5: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
    h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', lineHeight: 1.5 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
        sizeLarge: { padding: '12px 24px', fontSize: '1rem' },
        sizeMedium: { padding: '8px 20px', fontSize: '0.875rem' },
        sizeSmall: { padding: '6px 16px', fontSize: '0.8125rem' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 1px 2px rgba(0,0,0,0.06), 0px 1px 3px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            padding: '12px 16px',
            fontSize: '0.875rem',
            borderBottom: '1px solid #EEEEEE',
          },
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#757575',
            backgroundColor: '#FAFAFA',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: 'none', boxShadow: '16px 0 24px rgba(0,0,0,0.08)' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 500 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { borderRadius: 6, fontSize: '0.75rem', padding: '6px 10px' },
      },
    },
  },
});
```

## Dark Mode

```typescript
const darkTheme = createTheme({
  ...theme,
  palette: {
    mode: 'dark',
    primary: { main: '#90CAF9', light: '#BBDEFB', dark: '#42A5F5' },
    secondary: { main: '#CE93D8', light: '#E1BEE7', dark: '#AB47BC' },
    background: { default: '#121212', paper: '#1E1E1E' },
    text: { primary: '#E0E0E0', secondary: '#9E9E9E', disabled: '#616161' },
    divider: '#333333',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 1px 2px rgba(0,0,0,0.3), 0px 1px 3px rgba(0,0,0,0.4)',
          backgroundImage: 'none',
        },
      },
    },
  },
});
```
