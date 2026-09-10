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
        // The match viewer's pose set — still one-shot per the rule above,
        // just bigger beats than a settling card. Applied to a portrait's
        // own inner wrapper, never to the element carrying its ring
        // position, so a pose never has to fight a layout transform.
        'ring-jostle': {
          '0%, 100%': { transform: 'translateX(0) rotate(0deg)' },
          '25%': { transform: 'translateX(-4px) rotate(-3deg)' },
          '75%': { transform: 'translateX(4px) rotate(3deg)' },
        },
        'ring-whip': {
          '0%': { transform: 'translateX(0)' },
          '45%': { transform: 'translateX(210px)' },
          '70%': { transform: 'translateX(220px)' },
          '100%': { transform: 'translateX(0)' },
        },
        'ring-strike': {
          '0%': { transform: 'translateX(0) scale(1)' },
          '30%': { transform: 'translateX(10px) scale(0.96)' },
          '55%': { transform: 'translateX(-6px) scale(1.02)' },
          '100%': { transform: 'translateX(0) scale(1)' },
        },
        'ring-surge': {
          '0%': { transform: 'translateX(0) scale(1)' },
          '50%': { transform: 'translateX(-16px) scale(1.08)' },
          '100%': { transform: 'translateX(0) scale(1)' },
        },
        'ring-slam': {
          '0%': { transform: 'rotate(0deg) translateY(0)' },
          '40%': { transform: 'rotate(150deg) translateY(-10px)' },
          '70%': { transform: 'rotate(190deg) translateY(6px)' },
          '100%': { transform: 'rotate(180deg) translateY(0)' },
        },
        'callout-pop': {
          '0%': { opacity: '0', transform: 'scale(0.5) rotate(-6deg)' },
          '60%': { opacity: '1', transform: 'scale(1.15) rotate(3deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(-2deg)' },
        },
        // A battle-royal elimination — over the top and gone, settling into
        // the greyed-out "OUT" state the viewer holds them in afterward.
        'ring-eliminated': {
          '0%': { transform: 'translateY(0) rotate(0deg) scale(1)', opacity: '1' },
          '50%': { transform: 'translateY(-24px) rotate(120deg) scale(0.9)', opacity: '0.9' },
          '100%': { transform: 'translateY(30px) rotate(200deg) scale(0.7)', opacity: '0.4' },
        },
        // A near-fall's target — knocked down and left lying, not the full
        // lift-and-flip a signature/finisher gets (that's ring-slam). One
        // hit, a stagger, and down on their side.
        'ring-knockdown': {
          '0%': { transform: 'translateX(0) translateY(0) rotate(0deg)' },
          '30%': { transform: 'translateX(8px) translateY(-4px) rotate(20deg)' },
          '100%': { transform: 'translateX(-4px) translateY(10px) rotate(90deg)' },
        },
        // Ringside manager runs the ring, throws the shot, and gets back to
        // his corner before anyone official-looking notices — mirrored pair
        // because unlike the centre-stage poses above, this one travels from
        // a real left/right rest position rather than an already-shared spot.
        'ring-interfere-left': {
          '0%, 100%': { transform: 'translateX(0) scale(1)' },
          '35%': { transform: 'translateX(70px) scale(1.05)' },
          '55%': { transform: 'translateX(80px) scale(1.1)' },
          '80%': { transform: 'translateX(20px) scale(1.02)' },
        },
        'ring-interfere-right': {
          '0%, 100%': { transform: 'translateX(0) scale(1)' },
          '35%': { transform: 'translateX(-70px) scale(1.05)' },
          '55%': { transform: 'translateX(-80px) scale(1.1)' },
          '80%': { transform: 'translateX(-20px) scale(1.02)' },
        },
        // Applied to the ring panel itself, not a portrait — a beat with real
        // impact rattles the camera, not just the person in it.
        'ring-shake': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '20%': { transform: 'translate(-6px, 2px)' },
          '40%': { transform: 'translate(5px, -3px)' },
          '60%': { transform: 'translate(-4px, 3px)' },
          '80%': { transform: 'translate(3px, -2px)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pop-in': 'pop-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 2.2s linear infinite',
        'ring-jostle': 'ring-jostle 0.5s ease-in-out both',
        'ring-whip': 'ring-whip 0.9s ease-in-out both',
        'ring-strike': 'ring-strike 0.5s ease-out both',
        'ring-surge': 'ring-surge 0.5s ease-out both',
        'ring-slam': 'ring-slam 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'callout-pop': 'callout-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'ring-eliminated': 'ring-eliminated 0.8s cubic-bezier(0.34, 1.2, 0.64, 1) both',
        'ring-knockdown': 'ring-knockdown 0.55s cubic-bezier(0.34, 1.2, 0.64, 1) both',
        'ring-interfere-left': 'ring-interfere-left 0.9s ease-in-out both',
        'ring-interfere-right': 'ring-interfere-right 0.9s ease-in-out both',
        'ring-shake': 'ring-shake 0.4s ease-in-out both',
      },
    },
  },
  plugins: [],
};
