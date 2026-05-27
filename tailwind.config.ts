import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        notebook: {
          bg:     '#0d1117',
          cell:   '#161b22',
          border: '#30363d',
          text:   '#e6edf3',
          muted:  '#8b949e',
        },
        accent: {
          code:    '#1f6feb',
          ai:      '#7c3aed',
          data:    '#d97706',
          model:   '#059669',
          md:      '#374151',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
