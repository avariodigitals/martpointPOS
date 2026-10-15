/** Decorative botanical motifs for enhanced industry pages.
 *  Purely presentational — always aria-hidden, never carries content. */

export function LeafSprig({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M60 112V34"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M60 78C60 78 40 76 32 62 26 51 30 38 30 38s17 2 25 13c6 8 5 27 5 27Z"
        fill="currentColor"
        fillOpacity=".14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M60 58C60 58 80 56 88 42c6-11 2-24 2-24s-17 2-25 13c-6 8-5 27-5 27Z"
        fill="currentColor"
        fillOpacity=".14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M60 34c0-9 4-17 10-22 3 8 2 17-4 22"
        fill="currentColor"
        fillOpacity=".1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Leaf marker for benefit lists — replaces a plain checkmark. */
export function LeafBullet({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M13.5 2.5C7 2.5 3 5.5 3 10c0 1 .2 1.9.6 2.6C5.4 9 8.4 6.8 12 5.8 9 7.6 6.4 10 4.8 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
