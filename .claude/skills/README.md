# Vendored skills

These skills are **copied** (vendored) from
[vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) into
this repo. They are not git submodules, so they do **not** update automatically.

Only React skills are tracked here. Vercel-platform skills
(`deploy-to-vercel`, `vercel-cli-with-tokens`, `vercel-optimize`),
generic guideline skills (`web-design-guidelines`, `writing-guidelines`),
and the mobile-only `react-native-skills` are intentionally **not** installed.

## Installed

| Folder | Source path in repo |
|---|---|
| `composition-patterns` | `skills/composition-patterns` |
| `react-best-practices` | `skills/react-best-practices` |
| `react-view-transitions` | `skills/react-view-transitions` |

## Updating

Run the update script to re-pull the latest versions from upstream:

```bash
./.claude/skills/update-vercel-skills.sh
```

Then review what changed and commit:

```bash
git diff .claude/skills/
```

To start tracking another skill, add its folder name to the `SKILLS` array in
[update-vercel-skills.sh](update-vercel-skills.sh).
