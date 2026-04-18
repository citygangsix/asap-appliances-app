/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        slate: "#1f2937",
        fog: "#f3f4f6",
        panel: "#111827",
        accent: "#0f766e",
        sand: "#f8fafc",
      },
      boxShadow: {
        soft: "0 18px 45px -24px rgba(15, 23, 42, 0.28)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
