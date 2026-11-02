# Brandon Randle portfolio

Astro static portfolio for data engineering, data-platform SWE, and backend roles. Synthwave palette, custom signal-landscape SVGs, self-hosted fonts, original portrait, and preserved URLs.

## Development

Requires Node compatible with installed Astro version. Use lockfile for reproducible installs.

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
npm run preview
```

## Content

- `src/pages/index.astro`: introduction and selected projects.
- `src/components/Experience.astro`: employment and team experience.
- `src/components/SignalLandscape.astro`: decorative sunset, infrastructure, and telemetry SVG.
- `src/components/ProjectGlyph.astro`: project-specific SVG illustrations.
- `src/content/cases/*.md`: typed case metadata and engineering narratives.
- `src/pages/work/[slug].astro`: shared case template.
- `src/styles/global.css`: palette, layout, responsive rules, focus styles.
- `public/Brandon_Randle_SWE.docx`: current attached résumé; linked from navigation, Contact, and footer.
- `scripts/gen-og.mjs`: regenerate matching social preview with `node scripts/gen-og.mjs`.

Existing `/work/telemetry`, `/work/interview`, `/work/peekbar`, `/work/bms`, and `/contact` routes remain. New `/work/production-telemetry` covers internship ingestion work.

Gemstone rendering, diagnostics, fallback behavior, and validation: [caustics notes](docs/caustics.md). Use Node 22.12+; verified with Node 22.21.0.

Before publishing content updates, reconcile resume dates, project status, and metric scope. Synthetic workloads remain explicitly labeled. Use original-size evidence links for readable charts on phones.

## Deployment

Pushes to `main` in `cordialApple/brandon-randle-portfolio` trigger Cloudflare Pages: `npm run build`, output `dist`. Production URL: `https://brandon-randle-portfolio.pages.dev`.

## Validation

Run Astro diagnostics and build. Check home, work, contact, and all case routes at desktop and 390px width; confirm no overflow or header overlap. Follow resume, contact, source, and full-image links. Original portrait SHA-256 must match retained asset.
