import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0a0f1e',
        'dark-card': '#1e293b',
        'dark-border': '#334155',
        'primary': '#3b82f6',
        'accent': '#8b5cf6',
      },
      backgroundColor: {
        'dark': '#0a0f1e',
        'card': '#1e293b',
      },
      borderColor: {
        'dark': '#334155',
      },
    },
  },
  plugins: [],
}
export default config
