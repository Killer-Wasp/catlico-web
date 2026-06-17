import type { MantineColorsTuple, MantineTheme } from '@mantine/core'
import { createTheme } from '@mantine/core'

// ── Catlico palette ──────────────────────────────────────────────
// Sampled directly from the calico logo (public/catlico-logo.png).
// Each Mantine color needs exactly 10 shades (0 = lightest, 9 =
// darkest). Filled components use shade 6 in light mode, so the
// colour pulled straight from the logo sits at index 6 of each ramp.
//
// Source pixels:
//   ginger coat  #E4912C      black patch  #1F1F1E
//   cream coat   #FDF0DD      eye green    #AC992D / #D8C243
//   nose pink    #DC7C64

// Ginger coat — primary. The cat's orange patches; #E4912C at 6.
const ginger: MantineColorsTuple = [
  '#FBEBD8',
  '#F7DCBC',
  '#F3CD9F',
  '#EFBE82',
  '#EBAF65',
  '#E7A048',
  '#E4912C',
  '#AD6F24',
  '#774E1D',
  '#412D16',
]

// Cream coat → black patch. Warm neutral ramp that replaces
// Mantine's cool gray. #FDF0DD-tinted at 0 (page bg), #1F1F1E
// (black patch) at 9 for headings/body text.
const cream: MantineColorsTuple = [
  '#F6E9D5',
  '#E4D6C2',
  '#D2C4AF',
  '#C1B29C',
  '#AFA089',
  '#9D8E76',
  '#8C7C64',
  '#675D4C',
  '#433E35',
  '#1F1F1E',
]

// Eye green — golden-olive of the cat's eyes. Used for links and
// highlights. #AC992D at 6; the brighter #D8C243 lives around 3–4.
const olive: MantineColorsTuple = [
  '#F6F0D2',
  '#E9E1B6',
  '#DDD39B',
  '#D1C47F',
  '#C4B664',
  '#B8A748',
  '#AC992D',
  '#847525',
  '#5C521D',
  '#352F16',
]

// Nose pink — soft coral accent for badges and gentle highlights.
// #DC7C64 at index 5 so light fills (variant="light") stay blush.
const coral: MantineColorsTuple = [
  '#F9E5DF',
  '#F3D0C6',
  '#EDBBAD',
  '#E7A695',
  '#E1917C',
  '#DC7C64',
  '#B56753',
  '#8E5243',
  '#673D32',
  '#402922',
]

export const calicoTheme = createTheme({
  colors: {
    ginger,
    cream,
    olive,
    coral,
    // Override Mantine's default gray so neutral components
    // (borders, dividers, dimmed text) pick up the warm coat
    // tones instead of cool slate grays.
    gray: cream,
  },

  primaryColor: 'ginger',
  // Light mode fills with #E4912C; dark mode drops to a deeper
  // shade so filled buttons don't glow against dark surfaces.
  primaryShade: { light: 6, dark: 7 },

  white: '#FFFFFF',
  black: '#1F1F1E', // black patch — warm near-black for text

  defaultRadius: 'md',

  headings: {
    fontWeight: '600',
  },

  components: {
    Anchor: {
      defaultProps: {
        c: 'olive.7', // #847525 — accessible eye-green on cream/white
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
    Badge: {
      defaultProps: {
        color: 'coral',
        variant: 'light',
      },
    },
    Paper: {
      defaultProps: {
        withBorder: true,
      },
      styles: (theme: MantineTheme) => ({
        root: {
          // cream.1 in light mode, a dark coat shade in dark mode so
          // panel borders stay visible without glowing cream on black.
          borderColor: `light-dark(${theme.colors.cream[1]}, ${theme.colors.dark[4]})`,
        },
      }),
    },
  },

  other: {
    // Handy semantic aliases for app-level CSS
    pageBackground: '#FDF0DD', // cream coat
    surfaceBackground: '#FFFFFF',
    surfaceMuted: '#F6E9D5', // warm undercoat
    textPrimary: '#1F1F1E', // black patch
    textMuted: '#675D4C', // smoky grey-brown
  },
})
