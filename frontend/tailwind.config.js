/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],

  // Tailwind detectaba el fragmento `[-:T]` de una expresión regular usada
  // para fechas como si fuera una propiedad arbitraria y generaba CSS inválido
  // (`-: T;`). No es una clase de la interfaz y debe excluirse del build.
  blocklist: ['[-:T]'],

  theme: {
    extend: {
      fontFamily: {
        playfair: ['Playfair Display', 'serif'],
        vibes: ['Great Vibes', 'cursive'],
        dmserif: ['DM Serif Display', 'serif'],
        poppins: ['Poppins', 'sans-serif'],
        parisienne: ['Parisienne', 'cursive'],
      },
      colors: {
        rosa: {
          claro: '#fdf2f8',
          medio: '#fce7f3',
          fuerte: '#f9a8d4',
          profundo: '#f472b6',
        },
        marron: {
          claro: '#d6b7a3',
          medio: '#a98274',
          oscuro: '#8b5e3c',
        },
        dorado: {
          suave: '#fcefc7',
          intenso: '#e6c200',
        },
        blanco: {
          algodon: '#fffafa',
        },
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        zoomIn: {
          from: { transform: 'scale(0.35)', opacity: 0 },
          to: { transform: 'scale(1.5)', opacity: 1 },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-in': 'slide-in 0.4s ease-out',
        'fadeIn': 'fadeIn 1.0s ease-out',
        'zoomIn': 'zoomIn 1.0s ease-out',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};
