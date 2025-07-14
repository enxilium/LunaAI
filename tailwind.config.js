
module.exports = {
    content: ["./src/renderer/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Plus Jakarta Sans"', 'sans-serif'],
            },
            colors: {
                backgroundColor: 'rgb(var(--color-backgroundColor) / <alpha-value>)',
                backgroundColor2: 'rgb(var(--color-backgroundColor2) / <alpha-value>)',
                borderColor: 'rgb(var(--color-borderColor) / <alpha-value>)',
                accent: 'rgb(var(--color-accent) / <alpha-value>)',
                textColor: 'rgb(var(--color-textColor) / <alpha-value>)',
            },
        },
    },
    content: ['./src/**/*.{js,jsx,ts,tsx}'],
    plugins: [],
};
