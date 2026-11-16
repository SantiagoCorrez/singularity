import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: '#060912',
          card: '#0b1222',
          border: '#17213a',
          dim: '#7f8db0',
          text: '#d7def0',
        },
        accent: {
          cyan: '#3fd0ff',
          magenta: '#ff4fd8',
          yellow: '#ffd23f',
          green: '#39e58c',
          violet: '#a07bff',
          red: '#ff4f6d',
        },
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
