/** Original mosquito mark; continuous CSS animation follows the browser's refresh rate. */
export default function MosquitoIcon() {
  return (
    <svg
      className="mosquito-icon h-8 w-8 text-red-600"
      width="32"
      height="32"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <g className="mosquito-icon__flight">
        <g className="mosquito-icon__wing mosquito-icon__wing--left">
          <path d="M23 23C17 21 5 13 6 9C10 6 21 15 23 23Z" fill="#fecaca" />
          <path d="M9 11L22 22" strokeWidth="1" />
        </g>
        <g className="mosquito-icon__wing mosquito-icon__wing--right">
          <path d="M25 23C31 21 43 13 42 9C38 6 27 15 25 23Z" fill="#fecaca" />
          <path d="M39 11L26 22" strokeWidth="1" />
        </g>

        <path d="M21 23L13 22L6 28M21 27L12 31L8 39M22 31L17 37L16 44M27 23L35 22L42 28M27 27L36 31L40 39M26 31L31 37L32 44" />
        <path d="M22 14L19 9L15 7M26 14L29 9L33 7M24 11V3" />

        <path d="M21.5 25C21 31 22 39 24 43C26 39 27 31 26.5 25Z" fill="currentColor" />
        <path d="M22 30H26M22.5 34H25.5M23 38H25" stroke="#fff1f2" strokeWidth="1.2" />
        <ellipse cx="24" cy="21" rx="3.3" ry="5" fill="#fff1f2" />
        <circle cx="24" cy="14" r="2.5" fill="currentColor" />
      </g>
    </svg>
  );
}
