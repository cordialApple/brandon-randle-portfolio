# brandon-randle-portfolio

Personal portfolio for Brandon Randle — data engineering, systems performance, and AI-integrated workflows. Built as a multi-view deck: Home, Work, and Contact slide horizontally, and each Work tile opens its own case page.

## Stack

- **Astro 5** (static output) with `<ClientRouter />` view transitions for the slide navigation
- **TypeScript** (strict)
- Case studies as a typed **content collection** (`src/content/cases/*.md`)
- Plain CSS design tokens (`src/styles/global.css`) — no CSS framework
- Self-hosted variable fonts via Fontsource: Bricolage Grotesque (display), Instrument Sans (body), Martian Mono (labels/metrics)
- Target deploy: **Cloudflare Pages**

## Develop

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static build to ./dist
npm run preview   # serve the build
npm run check     # astro check (types + template diagnostics)
```

## Structure

```
src/
  pages/            index · work · contact · work/[slug]
  layouts/Base.astro    document shell, gradient frame, persistent nav + filmstrip
  components/        Nav · Strip · WorkTile · VaultDiagram
  content/cases/     one .md per case study (telemetry · bms · peekbar · interview)
  styles/global.css  design tokens + all component styles
public/assets/       dashboards, headshot, diagrams
```

## Content

Each case study is one markdown file with typed frontmatter (title, tag, accent, tiles, lede, hero, meta, delta, links). The schema lives in `src/content.config.ts`. Add a case by dropping a new `.md` in `src/content/cases/` — it appears on `/work` and gets its own `/work/<slug>` page automatically.
