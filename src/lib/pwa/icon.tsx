import { ImageResponse } from "next/og";

/**
 * PWA icon artwork — a gold cross rising from an open book on the brand navy.
 * Rendered to PNG at request/build time via next/og (no extra dependencies,
 * no fonts required since the mark is pure shapes).
 */
const BOOK_SVG = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g fill="#e8b64c">
    <rect x="238" y="96" width="36" height="150" rx="12"/>
    <rect x="196" y="140" width="120" height="34" rx="12"/>
  </g>
  <path d="M256 214 C210 186 150 184 104 198 L104 388 C150 372 210 374 256 400 C302 374 362 372 408 388 L408 198 C362 184 302 186 256 214 Z" fill="#f7efd6" stroke="#e8b64c" stroke-width="14" stroke-linejoin="round"/>
  <path d="M256 214 L256 400" stroke="#e8b64c" stroke-width="14" stroke-linecap="round"/>
</svg>`;

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Build a square PNG icon.
 * @param size    output dimension in px (square)
 * @param maskable when true, shrinks the mark so it stays inside the platform
 *                 "safe zone" (Android adaptive icons crop ~10% on each edge).
 */
export function renderIcon(size: number, opts?: { maskable?: boolean }): ImageResponse {
  const artScale = opts?.maskable ? 0.62 : 0.78;
  const art = Math.round(size * artScale);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #2a1b5e 0%, #131035 72%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={art} height={art} src={svgDataUri(BOOK_SVG)} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
