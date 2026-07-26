import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g1" cx="12%" cy="-8%" r="60%">
      <stop offset="0%" stop-color="#C4C9F7" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#C4C9F7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="92%" cy="-10%" r="55%">
      <stop offset="0%" stop-color="#F3C9E4" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#F3C9E4" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0D0D14"/>
  <rect width="1200" height="630" fill="url(#g1)"/>
  <rect width="1200" height="630" fill="url(#g2)"/>
  <rect x="24" y="24" width="1152" height="582" rx="28" fill="none" stroke="#2A2A3A" stroke-width="1.5"/>

  <rect x="83" y="66" width="3" height="34" fill="#B061FF"/>
  <rect x="68" y="81" width="34" height="3" fill="#B061FF"/>
  <text x="120" y="92" font-family="Consolas, monospace" font-size="22" letter-spacing="4" fill="#A9A8B6">BRANDON RANDLE</text>

  <text x="80" y="300" font-family="Segoe UI, sans-serif" font-weight="700" font-size="96" fill="#F4F3F7">I make messy state</text>
  <text x="80" y="404" font-family="Segoe UI, sans-serif" font-weight="700" font-size="96" fill="#FF5CB1">behave.</text>

  <text x="82" y="466" font-family="Consolas, monospace" font-size="22" letter-spacing="1" fill="#6E6D7C">Data Acquisition Lead · LSU Formula SAE · CS @ LSU</text>

  <text x="82" y="556" font-family="Consolas, monospace" font-size="23" letter-spacing="1">
    <tspan fill="#2E9BFF">systems optimization</tspan><tspan fill="#6E6D7C">  ·  </tspan><tspan fill="#37E0A0">prescriptive analytics</tspan><tspan fill="#6E6D7C">  ·  </tspan><tspan fill="#B061FF">AI-integrated workflows</tspan>
  </text>
</svg>`;

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" },
});
writeFileSync("public/og.png", resvg.render().asPng());
console.log("wrote public/og.png");
