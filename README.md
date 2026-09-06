# Brandon Randle portfolio

Astro static portfolio for data engineering, data-platform SWE, and backend roles. Keeps original portrait, palette, self-hosted fonts, and existing URLs.

## Development

Requires Node compatible with installed Astro version. Use lockfile for reproducible installs.

```sh
npm ci
npm run dev
npm run check
npm run build
npm run preview
```

## Content

- `src/pages/index.astro`: introduction and selected projects.
- `src/components/Experience.astro`: employment and team experience.
- `src/content/cases/*.md`: typed case metadata and engineering narratives.
- `src/pages/work/[slug].astro`: shared case template.
- `src/styles/global.css`: palette, layout, responsive rules, focus styles.
- `public/resume.pdf`: current one-page resume with embedded links.

Existing `/work/telemetry`, `/work/interview`, `/work/peekbar`, `/work/bms`, and `/contact` routes remain. New `/work/production-telemetry` covers internship ingestion work.

Before publishing content updates, reconcile resume dates, project status, and metric scope. Synthetic workloads remain explicitly labeled. Use original-size evidence links for readable charts on phones.

## Deployment

Existing Cloudflare Pages workflow remains `npm run build`, output `dist`. Canonical URL remains original public portfolio address.

## Validation

Run Astro diagnostics and build. Check home, work, contact, and all case routes at desktop and 390px width; confirm no overflow or header overlap. Follow resume, contact, source, and full-image links. Original portrait SHA-256 must match retained asset.
