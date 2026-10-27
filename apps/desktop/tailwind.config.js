/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0d1117',
        surface: '#161b22',
        'surface-elevated': '#21262d',
        'surface-hover': '#30363d',
        border: '#30363d',
        primary: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          glow: 'rgba(59, 130, 246, 0.4)',
        },
        accent: {
          cyan: '#06b6d4',
          purple: '#8b5cf6',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
        },
        text: {
          primary: '#f0f6fc',
          secondary: '#8b949e',
          muted: '#6e7681',
        }
      },
      fontFamily: {
        sans: ['Segoe UI Variable', 'Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['Cascadia Code', 'Consolas', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'glow-primary': '0 0 20px -3px rgba(59, 130, 246, 0.4)',
        'glow-cyan': '0 0 20px -3px rgba(6, 182, 212, 0.4)',
        'glow-purple': '0 0 20px -3px rgba(139, 92, 246, 0.4)',
      }
    },
  },
  plugins: [],
}
