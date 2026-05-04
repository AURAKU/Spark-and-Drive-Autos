/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");

module.exports = {
  darkMode: ["class", ".dark"],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: "var(--destructive)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        chart: {
          1: "var(--chart-1)",
          2: "var(--chart-2)",
          3: "var(--chart-3)",
          4: "var(--chart-4)",
          5: "var(--chart-5)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      ringWidth: {
        3: "3px",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    plugin(({ addVariant, addUtilities }) => {
      addVariant(
        "data-open",
        '&:where([data-state="open"]), &:where([data-open]:not([data-open="false"]))',
      );
      addVariant(
        "data-closed",
        '&:where([data-state="closed"]), &:where([data-closed]:not([data-closed="false"]))',
      );
      addVariant(
        "data-checked",
        '&:where([data-state="checked"]), &:where([data-checked]:not([data-checked="false"]))',
      );
      addVariant(
        "data-unchecked",
        '&:where([data-state="unchecked"]), &:where([data-unchecked]:not([data-unchecked="false"]))',
      );
      addVariant("data-selected", '&:where([data-selected="true"])');
      addVariant(
        "data-disabled",
        '&:where([data-disabled="true"]), &:where([data-disabled]:not([data-disabled="false"]))',
      );
      addVariant(
        "data-active",
        '&:where([data-state="active"]), &:where([data-active]:not([data-active="false"]))',
      );
      addVariant("data-horizontal", '&:where([data-orientation="horizontal"])');
      addVariant("data-vertical", '&:where([data-orientation="vertical"])');
      addVariant("data-popup-open", "&:where([data-popup-open])");
      addVariant("data-inset", "&:where([data-inset])");
      addVariant("data-instant", "&:where([data-instant])");
      addVariant("data-ending-style", "&:where([data-ending-style])");
      addVariant("data-starting-style", "&:where([data-starting-style])");
      addVariant("data-activation-direction-left", '&:where([data-activation-direction="left"])');
      addVariant("data-activation-direction-right", '&:where([data-activation-direction="right"])');
      addUtilities({
        ".outline-hidden": {
          outline: "2px solid transparent",
          "outline-offset": "2px",
        },
        ".outline-ring": {
          outline: "2px solid var(--ring)",
          "outline-offset": "2px",
        },
      });
    }),
  ],
};
