import type { Config } from 'tailwindcss';
const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { bg: c('bg'), surface: c('surface'), line: c('line'), ink: c('ink'), muted: c('muted'), marquee: c('marquee'), onmarquee: c('onmarquee'), reason: c('reason') },
    fontFamily: { display: ['Fraunces', 'Georgia', 'serif'], sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'] },
  } },
} satisfies Config;
