/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'mono': ['JetBrains Mono', 'monospace'],
        'sans': ['Inter', 'sans-serif'],
      },
      colors: {
        'obsidian': '#050505',
        'critical': '#FF3B30',
        'warning': '#FF9500',
        'safe': '#34C759',
        'info': '#007AFF',
      },
    },
  },
  plugins: [],
}
