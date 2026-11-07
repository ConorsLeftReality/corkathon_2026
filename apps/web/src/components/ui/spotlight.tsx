import { useId } from 'react'
import { cn } from '#src/lib/cn'

/** aceternity spotlight, one entrance on load then still, coloured by the text colour class */
export function Spotlight({ className }: { className?: string }) {
  // the registry hardcodes id="filter", which collides as soon as two are on a page
  const filterId = `spotlight-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg
      aria-hidden
      className={cn(
        'animate-spotlight pointer-events-none absolute z-0 h-[169%] w-[138%] opacity-0 lg:w-[84%]',
        className,
      )}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 3787 2842"
      fill="none"
    >
      <g filter={`url(#${filterId})`}>
        <ellipse
          cx="1924.71"
          cy="273.501"
          rx="1924.71"
          ry="273.501"
          transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
          fill="currentColor"
          fillOpacity="0.21"
        />
      </g>
      <defs>
        <filter
          id={filterId}
          x="0.860352"
          y="0.838989"
          width="3785.16"
          height="2840.26"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="151" result="blur" />
        </filter>
      </defs>
    </svg>
  )
}
