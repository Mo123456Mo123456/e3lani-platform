/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        midnight: {
          DEFAULT: 'var(--color-bg)',
          elevated: 'var(--color-bg-elevated)',
          surface: 'var(--color-surface)',
        },
        cyan: {
          accent: 'var(--color-accent)',
        },
        fg: {
          DEFAULT: 'var(--color-fg)',
          muted: 'var(--color-fg-muted)',
        },
        border: 'var(--color-border)',
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
        warm: 'var(--color-accent-warm)',
      },
      fontFamily: {
        display: ['"IBM Plex Sans Arabic"', '"Space Grotesk"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', '"IBM Plex Sans Arabic"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
