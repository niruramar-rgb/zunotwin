import React from 'react';

/**
 * ZUNO TWIN Professional Aquatic Shrimp Emblem & Brand Logo
 * Combines an anatomical/stylized shrimp motif within a circular cyber-physical ring
 * with neon cyan (#00F2FE), electric blue (#0072FF), and deep navy tones.
 */
export function ZunoLogo({
  size = 'md', // 'xs', 'sm', 'md', 'lg', 'xl', '2xl'
  iconOnly = false,
  showTagline = false,
  showVersion = false,
  variant = 'vector', // 'vector' | 'emblem'
  className = ''
}) {
  const sizeMap = {
    xs: { dim: 24, font: 'text-sm', sub: 'text-[9px]' },
    sm: { dim: 32, font: 'text-base', sub: 'text-[10px]' },
    md: { dim: 42, font: 'text-lg', sub: 'text-[11px]' },
    lg: { dim: 56, font: 'text-2xl', sub: 'text-xs' },
    xl: { dim: 72, font: 'text-3xl', sub: 'text-sm' },
    '2xl': { dim: 96, font: 'text-4xl', sub: 'text-base' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const renderIcon = () => {
    if (variant === 'emblem') {
      return (
        <img
          src="/zuno-emblem.png"
          alt="ZUNO TWIN Emblem"
          className="rounded-full object-contain filter drop-shadow-[0_0_12px_rgba(0,242,254,0.45)]"
          style={{ width: currentSize.dim, height: currentSize.dim }}
        />
      );
    }

    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="filter drop-shadow-[0_0_10px_rgba(0,242,254,0.4)] transition-transform hover:scale-105 shrink-0"
        style={{ width: currentSize.dim, height: currentSize.dim }}
      >
        <defs>
          <linearGradient id="zunoRingGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="50%" stopColor="#00A8FF" />
            <stop offset="100%" stopColor="#0072FF" />
          </linearGradient>

          <linearGradient id="zunoShrimpGrad" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="40%" stopColor="#38BDF8" />
            <stop offset="85%" stopColor="#0072FF" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>

          <radialGradient id="zunoCoreGlow" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#0A1128" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#060B18" stopOpacity="0.95" />
          </radialGradient>
        </defs>

        {/* Outer Circular Dark Cyber Disc */}
        <circle cx="50" cy="50" r="47" fill="url(#zunoCoreGlow)" stroke="#0E1E45" strokeWidth="1" />

        {/* Concentric Tech Rings */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="url(#zunoRingGrad)"
          strokeWidth="1.6"
          strokeDasharray="4 2"
          strokeOpacity="0.8"
        />
        <circle
          cx="50"
          cy="50"
          r="41"
          stroke="#00F2FE"
          strokeWidth="0.8"
          strokeOpacity="0.4"
        />

        {/* Sensor Node Orbital Accent Ticks */}
        <line x1="50" y1="2" x2="50" y2="7" stroke="#00F2FE" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="50" y1="93" x2="50" y2="98" stroke="#00F2FE" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="2" y1="50" x2="7" y2="50" stroke="#00F2FE" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="93" y1="50" x2="98" y2="50" stroke="#00F2FE" strokeWidth="1.5" strokeLinecap="round" />

        {/* Inner Water Ripple Rings */}
        <ellipse cx="50" cy="50" rx="36" ry="36" stroke="#00D2BA" strokeWidth="0.5" strokeOpacity="0.25" />

        {/* Long Sweeping Antennae reaching toward outer perimeter */}
        <path
          d="M 68 28 C 76 18, 86 16, 91 14"
          stroke="#00F2FE"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />
        <path
          d="M 65 26 C 72 12, 54 8, 32 12 C 20 14, 12 20, 10 27"
          stroke="#00F2FE"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.75"
        />

        {/* Serrated Rostrum Spine */}
        <path
          d="M 68 33 L 86 26 L 71 38 Z"
          fill="url(#zunoShrimpGrad)"
        />
        <path d="M 74 30 L 76 27 M 79 28 L 81 25" stroke="#00F2FE" strokeWidth="1.2" strokeLinecap="round" />

        {/* Eye */}
        <circle cx="67" cy="34" r="2.8" fill="#060B18" stroke="#00F2FE" strokeWidth="1.2" />
        <circle cx="67.5" cy="33.5" r="0.9" fill="#FFFFFF" />

        {/* Cephalothorax / Carapace */}
        <path
          d="M 52 42 C 54 34, 60 31, 70 35 C 74 39, 72 48, 62 51 C 56 53, 51 48, 52 42 Z"
          fill="url(#zunoShrimpGrad)"
          stroke="#00F2FE"
          strokeWidth="0.6"
        />

        {/* Abdominal Segments (Anatomical Arched Curve) */}
        {/* Segment 1 */}
        <path
          d="M 53 43 C 48 45, 43 49, 43 55 C 48 57, 56 55, 58 51 Z"
          fill="url(#zunoShrimpGrad)"
          stroke="#060B18"
          strokeWidth="0.8"
        />
        {/* Segment 2 */}
        <path
          d="M 44 51 C 38 55, 36 61, 38 67 C 43 69, 49 65, 49 59 Z"
          fill="url(#zunoShrimpGrad)"
          stroke="#060B18"
          strokeWidth="0.8"
        />
        {/* Segment 3 */}
        <path
          d="M 38 63 C 34 69, 36 75, 42 79 C 46 79, 48 73, 46 69 Z"
          fill="url(#zunoShrimpGrad)"
          stroke="#060B18"
          strokeWidth="0.8"
        />
        {/* Segment 4 */}
        <path
          d="M 40 75 C 43 81, 48 85, 55 85 C 57 83, 55 77, 49 75 Z"
          fill="url(#zunoShrimpGrad)"
          stroke="#060B18"
          strokeWidth="0.8"
        />
        {/* Segment 5 & 6 */}
        <path
          d="M 53 83 C 59 85, 67 83, 71 79 C 71 75, 65 75, 59 77 Z"
          fill="url(#zunoShrimpGrad)"
          stroke="#060B18"
          strokeWidth="0.8"
        />

        {/* Tail Fan: Telson & Paired Uropods */}
        <path
          d="M 69 79 L 88 81 C 90 79, 88 75, 73 75 Z"
          fill="url(#zunoRingGrad)"
          opacity="0.95"
        />
        <path
          d="M 71 80 L 91 86 C 91 82, 85 78, 73 77 Z"
          fill="url(#zunoRingGrad)"
          opacity="0.85"
        />
        <path
          d="M 69 81 L 84 90 C 86 88, 83 82, 71 79 Z"
          fill="url(#zunoRingGrad)"
          opacity="0.75"
        />

        {/* Walking Legs (Pereiopods) */}
        <path d="M 61 51 L 63 59 L 68 63" stroke="#00F2FE" strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
        <path d="M 57 53 L 59 61 L 64 65" stroke="#00F2FE" strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
        <path d="M 53 53 L 53 61 L 57 65" stroke="#00F2FE" strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />

        {/* Swimmerets (Pleopods) */}
        <path d="M 41 67 L 35 73" stroke="#38BDF8" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
        <path d="M 46 76 L 42 84" stroke="#38BDF8" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
        <path d="M 56 82 L 54 90" stroke="#38BDF8" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
      </svg>
    );
  };

  if (iconOnly) {
    return <div className={`inline-flex items-center ${className}`}>{renderIcon()}</div>;
  }

  return (
    <div className={`inline-flex items-center gap-3.5 ${className}`}>
      {renderIcon()}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`${currentSize.font} font-black tracking-wider text-white`}>
            ZUNO
          </span>
          <span className={`${currentSize.font} font-light tracking-widest text-cyan-neon`}>
            TWIN
          </span>
          {showVersion && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-neon/15 border border-cyan-neon/40 text-cyan-neon font-mono font-bold tracking-tight">
              v2.0
            </span>
          )}
        </div>
        {showTagline && (
          <p className={`${currentSize.sub} font-medium tracking-wider text-slate-400 mt-1 uppercase font-mono`}>
            Smarter Hatcheries. Healthier Shrimps.
          </p>
        )}
      </div>
    </div>
  );
}
