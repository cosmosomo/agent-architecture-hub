import type { Config } from 'tailwindcss';
import { agentPrismTailwindColors } from './src/components/agent-prism/theme';

// Colors are AgentPrism's tokens; their values come from src/hub-theme.css (the observatory's palette).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: agentPrismTailwindColors,
      fontFamily: {
        sans: ['Inter', '"Segoe UI"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', '"Cascadia Mono"', 'monospace'],
        display: ['"Space Grotesk"', 'Inter', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
} satisfies Config;
