/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          temaSky: {
            DEFAULT: "rgb(var(--color-accent-primary) / <alpha-value>)",
            light: "rgb(var(--color-accent-light) / <alpha-value>)",
            dark: "rgb(var(--color-accent-dark) / <alpha-value>)",
          },
          temaEmerald: {
            DEFAULT: "rgb(var(--color-secondary-primary) / <alpha-value>)",
            light: "rgb(var(--color-secondary-light) / <alpha-value>)",
            dark: "rgb(var(--color-secondary-dark) / <alpha-value>)",
          },
          temaViolet: {
            DEFAULT: "rgb(var(--color-tertiary-primary) / <alpha-value>)",
            light: "rgb(var(--color-tertiary-light) / <alpha-value>)",
            dark: "rgb(var(--color-tertiary-dark) / <alpha-value>)",
          },
        },
      },
    },
    plugins: [],
  };
  
