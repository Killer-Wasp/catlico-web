<!-- intent-skills:start -->
## Skill Loading

Before substantial work:
- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# catlico-web

## UI

- This project uses **Mantine v9** for UI. Apply v9 conventions (not older versions).
- For Mantine APIs, components, theming, and hooks, consult the LLM-optimized docs: https://mantine.dev/llms.txt (index) or https://mantine.dev/llms-full.txt (full content)
- Prefer Mantine component style props (`c`, `bg`, `ff`, `fz`, `fw`, `lts`, `mt`, `w`, etc.) and inline `style` over CSS modules. Use Mantine theme colour tokens (e.g. `red.6`, `c="dimmed"`) rather than raw `var(--...)` CSS vars. Only introduce a `.module.css` file if the styling genuinely can't be expressed with Mantine props/inline style.
- Prefer Mantine components (`Text`, `Flex`, `Box`, `Group`, `Stack`, etc.) over raw HTML elements like `div` plus CSS.
