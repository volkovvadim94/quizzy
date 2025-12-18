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
    ],
  },
}
