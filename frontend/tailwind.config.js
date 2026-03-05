/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#3b5bdb',
          900: '#364fc7',
        },
        success: {
          50: '#ebfbee',
          500: '#40c057',
          700: '#2f9e44',
        },
        warning: {
          50: '#fff9db',
          500: '#fab005',
          700: '#f08c00',
        },
        danger: {
          50: '#fff5f5',
          500: '#fa5252',
          700: '#e03131',
        },
      },
    },
  },
  plugins: [],
}
