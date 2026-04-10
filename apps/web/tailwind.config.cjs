/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        violet: {
          950: '#1a0533',
        },
      },
      fontFamily: {
        sans: ['var(--font-display)', 'Syne', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Syne', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'Space Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'float-up': 'floatUp 3s ease-out forwards',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        floatUp: {
          '0%': { opacity: '0', transform: 'translateY(0)' },
          '20%': { opacity: '1' },
          '80%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateY(-40px)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
      boxShadow: {
        glow: '0 0 40px rgba(124, 58, 237, 0.25)',
        'glow-sm': '0 0 20px rgba(124, 58, 237, 0.15)',
      },
    },
  },
  plugins: [],
};
