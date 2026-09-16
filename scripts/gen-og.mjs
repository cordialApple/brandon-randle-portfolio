import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";

const gridLines = Array.from({ length: 13 }, (_, i) => `<path d="M880 350L${360 + i * 90} 630"/>`).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="sun" x2="0" y2="1"><stop stop-color="#ffae83"/><stop offset="1" stop-color="#ff4fa0"/></linearGradient>
    <radialGradient id="sky"><stop stop-color="#6a204c" stop-opacity=".5"/><stop offset="1" stop-color="#090713" stop-opacity="0"/></radialGradient>
    <clipPath id="sun-clip"><circle cx="925" cy="280" r="135"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#090713"/>
  <ellipse cx="925" cy="290" rx="370" ry="300" fill="url(#sky)"/>
  <path d="M60 100H1140M60 555H1140" stroke="#332443"/>
  <path d="M64 74L74 56L84 74L94 56L104 74" fill="none" stroke="#ff4fa0" stroke-width="3"/>
  <text x="124" y="76" font-family="Segoe UI,sans-serif" font-size="23" fill="#f7f2fa">Brandon Randle.</text>
  <g clip-path="url(#sun-clip)">
    <rect x="780" y="140" width="290" height="290" fill="url(#sun)"/>
    <path d="M780 285H1070M780 307H1070M780 333H1070M780 364H1070M780 400H1070" stroke="#090713" stroke-width="9"/>
  </g>
  <path d="M640 420L700 371L737 393L793 344L843 395L880 374L956 420L1040 349L1140 413L1200 380V630H640Z" fill="#110a20" stroke="#9d80ff" stroke-opacity=".55"/>
  <g stroke="#ff4fa0" stroke-opacity=".23" fill="none">${gridLines}<path d="M640 445H1200M640 471H1200M640 508H1200M640 555H1200M640 615H1200"/></g>
  <path d="M669 489H723L741 467L760 498L792 424L820 482L841 459H881L904 476L936 441L958 465H1002L1024 432L1047 453H1138" fill="none" stroke="#6de5f2" stroke-width="3"/>
  <text x="60" y="169" font-family="Consolas,monospace" font-size="17" letter-spacing="2" fill="#b3a9c4">DATA ENGINEERING / BACKEND SYSTEMS</text>
  <text x="56" y="290" font-family="Segoe UI,sans-serif" font-weight="700" font-size="100" letter-spacing="-6" fill="#f7f2fa">From noise</text>
  <text x="56" y="397" font-family="Segoe UI,sans-serif" font-weight="700" font-size="100" letter-spacing="-6" fill="#f7f2fa">to <tspan fill="#ff4fa0">signal.</tspan></text>
  <text x="60" y="463" font-family="Segoe UI,sans-serif" font-size="23" fill="#b3a9c4">Pipelines that make data useful.</text>
  <text x="60" y="499" font-family="Segoe UI,sans-serif" font-size="23" fill="#b3a9c4">Systems that keep it moving.</text>
  <text x="60" y="598" font-family="Consolas,monospace" font-size="16" fill="#b3a9c4">CS + Mathematics @ LSU</text>
  <text x="1140" y="598" text-anchor="end" font-family="Consolas,monospace" font-size="16" fill="#6de5f2">Source → System → Signal</text>
</svg>`;

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" },
});
writeFileSync("public/og.png", resvg.render().asPng());
console.log("wrote public/og.png");
