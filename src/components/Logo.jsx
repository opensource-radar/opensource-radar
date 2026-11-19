// The radar mark. Decorative: it always sits next to the project's name.
// Its sweep turns continuously, except for people who prefer reduced motion.
function Logo() {
  return (
    <svg className="site-logo" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" opacity=".55" />
      {/* The sweep turns like a real radar (see .radar-sweep in App.css). */}
      <g className="radar-sweep">
        <path d="M16 16 L16 1.5 A14.5 14.5 0 0 1 26.25 5.75 Z" fill="currentColor" opacity=".35" />
        <path d="M16 16 L26.25 5.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* Two blips light up as the sweep passes them, then fade. */}
      <circle className="radar-blip radar-blip-1" cx="26.34" cy="19.76" r="1.6" fill="currentColor" />
      <circle className="radar-blip radar-blip-2" cx="10.8" cy="19" r="1.4" fill="currentColor" />
      <circle cx="16" cy="16" r="2.4" fill="currentColor" />
    </svg>
  );
}

export default Logo;
