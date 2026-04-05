export default {
  plugins: {
    "./unocss-postcss-plugin.cjs": {
      content: ["./app/**/*.{html,js,ts,jsx,tsx}", "./components/**/*.{html,js,ts,jsx,tsx}"],
    },
  },
};
