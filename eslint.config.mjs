import nextCoreVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreVitals,
  {
    ignores: [".next/**", ".next-*/**", "coverage/**", "playwright-report/**", "test-results/**", "node_modules/**"],
  },
];

export default config;
