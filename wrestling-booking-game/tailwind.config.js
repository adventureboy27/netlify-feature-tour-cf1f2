/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // A few real elevation levels beyond Tailwind's default shadow scale —
      // used sparingly, on the surfaces that are actually meant to lift off
      // the page (a hero panel, a modal, the bottom nav) rather than on every
      // card. A shadow on everything reads as a shadow on nothing.
      boxShadow: {
        panel: '0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 8px 24px -12px rgb(0 0 0 / 0.55)',
        hero: '0 1px 0 0 rgb(255 255 255 / 0.05) inset, 0 16px 40px -16px rgb(0 0 0 / 0.65)',
        nav: '0 -8px 24px -8px rgb(0 0 0 / 0.5)',
        'glow-sm': '0 0 0 1px var(--tw-shadow-color), 0 0 12px -2px var(--tw-shadow-color)',
      },
      // Short, purposeful motion — a card settling in, a value ticking up, a
      // screen taking its turn. Nothing loops, nothing is decorative for its
      // own sake; the point is to say "this just changed" the same way a
      // score bug does on a broadcast.
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pop-in': 'pop-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 2.2s linear infinite',
      },
    },
  },
  plugins: [],
};
