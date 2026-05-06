/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Burgundy + olive palette (olive matches the logo ink exactly).
        burgundy: "#4A0E1A",
        maroon: "#6B1224",
        wine: "#821829",
        // `gold` is the legacy class name — value is now olive (#46543B,
        // sampled from the Lama Wafa logo) so existing utilities like
        // `bg-gold` / `text-gold` resolve to the new brand accent.
        gold: "#46543B",
        olive: "#46543B",
        blush: "#FADADD",
        rose: "#F4A6A6",
        ivory: "#FFF8F0",
        cream: "#FFF8F0",
        charcoal: "#333333",
        // Translucent tokens
        burgundy50: "rgba(74,14,26,0.5)",
        gold10: "rgba(70,84,59,0.10)",
        olive10: "rgba(70,84,59,0.10)",
      },
      fontFamily: {
        sans: ['"Poppins"', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: "0 6px 24px rgba(74,14,26,0.12)",
        medium: "0 8px 30px rgba(74,14,26,0.15)",
        elevated: "0 20px 50px rgba(74,14,26,0.2)",
        glow: "0 0 30px rgba(70,84,59,0.30)",
        "glow-lg": "0 0 50px rgba(70,84,59,0.40)",
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.5s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.6s ease-out forwards',
        'slide-in-right': 'slideInRight 0.6s ease-out forwards',
        'bounce-slow': 'bounceSlow 2s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-60px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(60px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        bounceSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(2deg)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, rgba(74,14,26,0.9) 0%, rgba(107,18,36,0.7) 50%, rgba(130,24,41,0.8) 100%)',
      },
    },
  },
  plugins: [],
};
