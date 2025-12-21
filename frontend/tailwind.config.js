/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Inter'", 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '16px',
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        quizzyDark: {
          "primary": "#3a4de6",
          "primary-content": "#f8fbff",
          "secondary": "#A855F7",
          "secondary-content": "#0F0A1A",
          "accent": "#22D3EE",
          "accent-content": "#041016",
          "neutral": "#0B1224",
          "neutral-content": "#FFFFFF",
          "base-100": "#0D1220",
          "base-200": "#0A0F1B",
          "base-300": "#060A14",
          "base-content": "#FFFFFF",
          "info": "#38BDF8",
          "success": "#22C55E",
          "warning": "#FBBF24",
          "error": "#F87171",
        },
      },
      {
        quizzyLight: {
          "primary": "#2563eb",
          "primary-content": "#ffffff",
          "secondary": "#d946ef",
          "secondary-content": "#0b1224",
          "accent": "#22c55e",
          "accent-content": "#0b1224",
          "neutral": "#0b1224",
          "neutral-content": "#ffffff",
          "base-100": "#ffffff",
          "base-200": "#eef2ff",
          "base-300": "#e2e8f0",
          "base-content": "#0b1224",
          "info": "#38bdf8",
          "success": "#22c55e",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
      },
    ],
  },
}
