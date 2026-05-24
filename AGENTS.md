# Repository Expectations — anti-website

This repository is worked on by Codex, Claude Code CLI, and Gemini CLI.

- `AGENTS.md` is the shared instruction source for all agents.
- `CLAUDE.md` and `GEMINI.md` carry agent-specific elaborations and inherit from this file.
- If shared project guidance conflicts with agent-specific guidance, prefer the shared rules in this file.

## Source Files That Matter

- `CLAUDE.md` — full project context, architecture, Claude-specific tooling
- `GEMINI.md` — compact version of the same project context for Gemini
- `README.md` — user-facing project summary and directory map
- `index.html` — main landing page markup
- `styles.css` — modern vanilla CSS styling
- `main.js` — core JavaScript and GSAP logic
- `particles.js` — Three.js particle systems

## Architecture Rules

- Use Vanilla CSS for all styling (no TailwindCSS or other utilities).
- Ensure fast page loads by optimizing JS bundle and shader rendering.
- Keep components clean, separate JS logic from styling and shaders.
- Never write placeholders or incomplete code.

## Global Windows Tooling

- The machine-wide Windows CLI baseline lives in `C:\Tools\TOOLING.md`.
- Repo and agent workflows in this checkout should assume `python` as the default Python command.
- Mention `py` only when explicit multi-version selection is the point.

## Security Rules

- Never edit or delete `.env` files unless the task explicitly targets environment configuration.
- Never edit or delete `scripts/*secrets*.ps1`, `scripts/bw-login.ps1`, `scripts/load-secrets.ps1`, or `scripts/restore-secrets.ps1` unless explicitly asked.

## Commands

- Run dev server: `npm run dev`
- Build production bundle: `npm run build`
- Validate tooling pointers: `pwsh C:\Tools\check-tooling-pointer.ps1 E:\anti-website`

## Done Means

A task is not complete until all relevant items below are satisfied:

- The requested behavior is implemented or the requested analysis is complete.
- Architecture and security rules still hold.
- Relevant checks have been run when feasible.
- The diff has been reviewed for regressions.

## Working Style

- Quality over speed.
- Make scoped changes, not speculative rewrites.
- For multi-step or high-risk work, keep an explicit plan and update it as the task evolves.
