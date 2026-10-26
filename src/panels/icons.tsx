// Inline SVG icons drawn in currentColor, so they follow the strip states and selected rows.

/** Gradient bar with tick marks below, so it reads as a colorbar; follows the icon's state color. */
export function ColorbarIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <defs>
        <linearGradient id="cbar">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.1" />
          <stop offset="1" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="3.5" width="13" height="5" fill="url(#cbar)" stroke="currentColor" />
      <path d="M2 8.5v3.5M8 8.5v3.5M14 8.5v3.5" stroke="currentColor" />
    </svg>
  )
}

/** A small triangulated mesh: a slightly asymmetric diamond split into four triangles. */
export function MeshIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path
        d="M8 1 15 7 7 15 1 8.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path d="M9 8 8 1M9 8 15 7M9 8 7 15M9 8 1 8.5" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  )
}

/** The mesh icon with one face painted: per-vertex data on a mesh. */
export function MeshLayerIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path d="M8 1 15 7 9 8Z" fill="currentColor" />
      <path d="M8 1 15 7 7 15 1 8.5Z" fill="none" stroke="currentColor" strokeLinejoin="round" />
      <path d="M9 8 8 1M9 8 15 7M9 8 7 15M9 8 1 8.5" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  )
}
