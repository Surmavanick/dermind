import type { SVGProps } from "react";

/**
 * Dermio brand mark: a "D" whose bowl doubles as a magnifier lens,
 * with a single dot (the lesion under examination) inside.
 * Uses currentColor so it inherits text color from its container.
 */
const DermioLogo = ({ width = 18, height = 18, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={width}
    height={height}
    aria-hidden="true"
    {...props}
  >
    <path d="M8 6v20" />
    <path d="M8 6h5a10 10 0 0 1 0 20H8" />
    <path d="M20.6 23.4 26.5 29.3" />
    <circle cx="14.2" cy="16" r="2.1" fill="currentColor" stroke="none" />
  </svg>
);

export default DermioLogo;
