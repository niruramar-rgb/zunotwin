import React from 'react';

/**
 * Reusable Anatomical Shrimp Icon (Litopenaeus vannamei)
 * Features curved segmented abdomen, uropod/telson tail fan, long sweeping antennae,
 * rostrum, and walking legs with neon cyan and electric-blue styling.
 */
export function ShrimpIcon({ 
  className = "w-6 h-6", 
  size, 
  glow = true, 
  color = "#00F2FE",
  secondaryColor = "#0072FF" 
}) {
  const style = size ? { width: size, height: size } : {};

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${glow ? 'filter drop-shadow-[0_0_8px_rgba(0,242,254,0.45)]' : ''}`}
      style={style}
    >
      <defs>
        <linearGradient id="shrimpGradPrimary" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color} />
          <stop offset="50%" stopColor="#4FACFE" />
          <stop offset="100%" stopColor={secondaryColor} />
        </linearGradient>
        <linearGradient id="shrimpGradAntenna" x1="0" y1="0" x2="48" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00D2FF" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Primary Sweeping Dorsal Antennae (Long, curved back over carapace) */}
      <path
        d="M 32 12 C 38 6, 44 4, 46 2"
        stroke="url(#shrimpGradAntenna)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M 30 11 C 36 3, 26 1, 14 3 C 8 4, 3 8, 2 12"
        stroke="url(#shrimpGradAntenna)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Rostrum (Serrated Forward Spine at Head) */}
      <path
        d="M 32 15 L 43 11 L 34 18 Z"
        fill="url(#shrimpGradPrimary)"
      />
      <path
        d="M 36 13 L 37 11.5 M 39 12 L 40 10.5"
        stroke="#00F2FE"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* Shrimp Eye (Dark bead on stalk) */}
      <circle cx="31.5" cy="15.5" r="1.6" fill="#050814" stroke="#00F2FE" strokeWidth="0.8" />
      <circle cx="31.8" cy="15.2" r="0.5" fill="#FFFFFF" />

      {/* Cephalothorax / Carapace (Main Head & Thorax shield) */}
      <path
        d="M 23 20 C 24 16, 27 14, 33 16 C 35 18, 34 23, 29 25 C 26 26, 23 23, 23 20 Z"
        fill="url(#shrimpGradPrimary)"
        fillOpacity="0.95"
      />

      {/* Abdominal Segment 1 */}
      <path
        d="M 24 20 C 21 21, 19 23, 19 26 C 22 27, 26 26, 27 24 C 27 22, 25 20, 24 20 Z"
        fill="url(#shrimpGradPrimary)"
        stroke="#050814"
        strokeWidth="0.6"
      />

      {/* Abdominal Segment 2 (Hump Peak) */}
      <path
        d="M 19 24 C 16 26, 15 29, 16 32 C 18 33, 22 31, 22 28 C 22 26, 20 25, 19 24 Z"
        fill="url(#shrimpGradPrimary)"
        stroke="#050814"
        strokeWidth="0.6"
      />

      {/* Abdominal Segment 3 (Curving down) */}
      <path
        d="M 16 30 C 14 33, 15 36, 18 38 C 20 38, 21 35, 20 33 C 19 31, 17 30, 16 30 Z"
        fill="url(#shrimpGradPrimary)"
        stroke="#050814"
        strokeWidth="0.6"
      />

      {/* Abdominal Segment 4 */}
      <path
        d="M 17 36 C 18 39, 21 41, 24 41 C 25 40, 24 37, 21 36 C 19 35, 18 35, 17 36 Z"
        fill="url(#shrimpGradPrimary)"
        stroke="#050814"
        strokeWidth="0.6"
      />

      {/* Abdominal Segment 5 & 6 (Tapering toward tail) */}
      <path
        d="M 23 40 C 26 41, 30 40, 32 38 C 32 36, 29 36, 26 37 C 24 38, 23 39, 23 40 Z"
        fill="url(#shrimpGradPrimary)"
        stroke="#050814"
        strokeWidth="0.6"
      />

      {/* Tail Fan: Telson (Center Point) & Uropods (Paired Lateral Fins) */}
      <path
        d="M 31 38 L 41 39 C 42 38, 41 36, 33 36 Z"
        fill="url(#shrimpGradPrimary)"
        opacity="0.9"
      />
      <path
        d="M 32 38.5 L 43 42 C 43 40, 39 37.5, 33 37 Z"
        fill="url(#shrimpGradPrimary)"
        opacity="0.8"
      />
      <path
        d="M 31 39 L 39 44 C 40 43, 38 40, 32 38 Z"
        fill="url(#shrimpGradPrimary)"
        opacity="0.7"
      />

      {/* Walking Legs (Pereiopods under thorax) */}
      <path
        d="M 28 25 L 29 29 L 32 31"
        stroke="#00F2FE"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M 26 26 L 27 30 L 30 32"
        stroke="#00F2FE"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M 24 26 L 24 30 L 26 32"
        stroke="#00F2FE"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Swimmerets (Pleopods under abdomen) */}
      <path
        d="M 18 33 L 15 36"
        stroke="#4FACFE"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M 20 37 L 18 41"
        stroke="#4FACFE"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M 25 40 L 24 44"
        stroke="#4FACFE"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}
