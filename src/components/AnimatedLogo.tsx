import React from 'react';

export interface AnimatedLogoProps {
  /** Size variant of the logo */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero' | 'screen' | 'custom';
  /** Custom pixel / rem size if size='custom' */
  customSize?: string;
  /** Whether animation is enabled (respects prefers-reduced-motion automatically) */
  animate?: boolean;
  /** Whether to enable gentle floating motion */
  floating?: boolean;
  /** Whether to enable light sweep shine across the logo */
  lightSweep?: boolean;
  /** Whether to enable smooth RGB color spectrum hue cycling */
  colorCycling?: boolean;
  /** Speed of color spectrum cycling in seconds (default: 8s) */
  spectrumSpeed?: number;
  /** Custom class for the wrapper */
  className?: string;
  /** Background theme context: 'dark' | 'light' | 'auto' */
  theme?: 'dark' | 'light' | 'auto';
  /** Optional click handler */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Tooltip or title attribute */
  title?: string;
}

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  size = 'md',
  customSize,
  animate = true,
  floating = true,
  lightSweep = true,
  colorCycling = true,
  spectrumSpeed = 8,
  className = '',
  theme = 'dark',
  onClick,
  title = 'Police Around Town'
}) => {
  // Dimension definitions with strict aspect ratio 1:1 and balanced proportions
  const sizeMap: Record<string, string> = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
    hero: 'w-24 h-24 sm:w-28 sm:h-28',
    screen: 'w-32 h-32 sm:w-40 sm:h-40'
  };

  const containerSizeClass = size === 'custom' && customSize ? customSize : sizeMap[size] || sizeMap.md;

  // Adaptive glow tuning based on size to ensure optimum performance on all devices
  const isLarge = size === 'hero' || size === 'screen' || size === 'xl';
  const isSmall = size === 'xs' || size === 'sm';

  return (
    <div
      onClick={onClick}
      title={title}
      role="img"
      aria-label="Police Around Town Official Neon Shield Emblem"
      className={`relative inline-flex items-center justify-center select-none flex-shrink-0 ${containerSizeClass} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        perspective: '1000px',
      }}
    >
      {/* 1. Floating & Breathing Container (Strictly transparent with zero background, box, or circle) */}
      <div
        className={`relative w-full h-full flex items-center justify-center ${
          animate && floating ? 'pat-floating' : ''
        } ${animate ? 'pat-breathing' : ''}`}
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {/* 2. Emblem Body with Dynamic RGB Hue Shift & Neon Drop-Shadow */}
        <div
          className={`relative w-full h-full flex items-center justify-center overflow-visible ${
            animate && colorCycling ? 'pat-color-cycle' : ''
          }`}
          style={{
            animationDuration: `${spectrumSpeed}s`,
            filter: isSmall
              ? 'drop-shadow(0 0 4px rgba(6,182,212,0.85))'
              : theme === 'light'
              ? 'drop-shadow(0 2px 8px rgba(15,23,42,0.3)) drop-shadow(0 0 10px rgba(219,39,119,0.5))'
              : 'drop-shadow(0 0 8px rgba(6,182,212,0.85)) drop-shadow(0 0 18px rgba(147,51,234,0.6)) drop-shadow(0 0 30px rgba(225,29,72,0.35))',
          }}
        >
          {/* SVG Vector Reproduction of the EXACT Uploaded Police Around Town Badge */}
          <svg
            viewBox="0 0 500 500"
            className="w-full h-full object-contain filter"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Neon Glow Filter */}
              <filter id="pat-neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={isSmall ? 1.5 : 4} result="blur1" />
                <feGaussianBlur stdDeviation={isSmall ? 3 : 10} result="blur2" />
                <feMerge>
                  <feMergeNode in="blur2" />
                  <feMergeNode in="blur1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Dynamic Gradients */}
              <linearGradient id="pat-shield-rim-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff007f" />
                <stop offset="45%" stopColor="#7928ca" />
                <stop offset="100%" stopColor="#00f2fe" />
              </linearGradient>

              <linearGradient id="pat-metal-bevel-grad" x1="0%" y1="0%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#e11d48" />
              </linearGradient>

              <linearGradient id="pat-silver-bevel" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="50%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>

              {/* Shimmer Light Sweep Clip Path */}
              <clipPath id="pat-shield-clip">
                <path d="M140 65 L360 65 L405 135 L385 240 L250 440 L115 240 L95 135 Z" />
              </clipPath>
            </defs>

            {/* --- Shield Exterior 3D Faceted Rim Armor Plates --- */}
            {/* Top Rim Left & Right */}
            <path
              d="M170 65 L250 65 L250 95 L185 95 Z"
              fill="#1e1b4b"
              stroke="url(#pat-shield-rim-grad)"
              strokeWidth="3.5"
            />
            <path
              d="M250 65 L330 65 L315 95 L250 95 Z"
              fill="#1e1b4b"
              stroke="url(#pat-shield-rim-grad)"
              strokeWidth="3.5"
            />

            {/* Left Upper Shield Bevel Armor */}
            <path
              d="M165 68 L100 135 L118 240 L150 220 L135 150 L180 98 Z"
              fill="#0f172a"
              stroke="url(#pat-metal-bevel-grad)"
              strokeWidth="4"
              filter="url(#pat-neon-glow)"
            />

            {/* Right Upper Shield Bevel Armor */}
            <path
              d="M335 68 L400 135 L382 240 L350 220 L365 150 L320 98 Z"
              fill="#0f172a"
              stroke="url(#pat-metal-bevel-grad)"
              strokeWidth="4"
              filter="url(#pat-neon-glow)"
            />

            {/* Lower Shield Bevel Plating (Left & Right Flanks) */}
            <path
              d="M118 245 L150 335 L190 320 L160 250 Z"
              fill="#0f172a"
              stroke="url(#pat-shield-rim-grad)"
              strokeWidth="3.5"
            />
            <path
              d="M382 245 L350 335 L310 320 L340 250 Z"
              fill="#0f172a"
              stroke="url(#pat-shield-rim-grad)"
              strokeWidth="3.5"
            />

            {/* Bottom Shield V-Apex Base Armor */}
            <path
              d="M250 435 L170 375 L200 345 L250 380 L300 345 L330 375 Z"
              fill="#090d16"
              stroke="#00f2fe"
              strokeWidth="4.5"
              filter="url(#pat-neon-glow)"
            />
            {/* Small Triangle Chevron Tip */}
            <polygon
              points="250,405 235,385 265,385"
              fill="none"
              stroke="#00f2fe"
              strokeWidth="3"
              filter="url(#pat-neon-glow)"
            />

            {/* Inner Shield Body Glass Backdrop */}
            <path
              d="M140 105 L360 105 L380 235 L250 385 L120 235 Z"
              fill="#050811"
              fillOpacity="0.9"
              stroke="url(#pat-shield-rim-grad)"
              strokeWidth="3"
            />

            {/* Inner Atmospheric Nebula Neon Glow Splashes */}
            <circle cx="190" cy="180" r="75" fill="#e11d48" fillOpacity="0.45" filter="url(#pat-neon-glow)" />
            <circle cx="310" cy="220" r="85" fill="#00f2fe" fillOpacity="0.45" filter="url(#pat-neon-glow)" />
            <circle cx="250" cy="150" r="60" fill="#a855f7" fillOpacity="0.35" filter="url(#pat-neon-glow)" />

            {/* --- TEXT: 'POLICE' Neon Tube Sign Header --- */}
            <g filter="url(#pat-neon-glow)">
              <text
                x="250"
                y="140"
                textAnchor="middle"
                fill="#ffffff"
                stroke="#ffffff"
                strokeWidth="1.2"
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="900"
                fontSize="36"
                letterSpacing="4"
              >
                POLICE
              </text>
              {/* Neon Underline Bar */}
              <line
                x1="155"
                y1="154"
                x2="345"
                y2="154"
                stroke="#ffffff"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            </g>

            {/* --- Center Crest: Neon Eagle Head --- */}
            <g filter="url(#pat-neon-glow)">
              <path
                d="M250 168 C242 168 232 174 230 184 L230 220 L240 235 L250 226 L260 235 L270 220 L270 184 C268 174 258 168 250 168 Z"
                fill="none"
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              {/* Eagle Beak profile */}
              <path
                d="M230 185 L222 192 L230 196"
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </g>

            {/* --- Neon Eagle Wings / Laurels (6 Radiant Feather Arcs) --- */}
            <g filter="url(#pat-neon-glow)">
              {/* Left Top Leaf */}
              <path
                d="M142 192 C190 220 225 240 248 310 C210 270 170 240 142 192 Z"
                fill="none"
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              {/* Left Middle Leaf */}
              <path
                d="M154 235 C195 260 220 280 248 312 C205 295 180 270 154 235 Z"
                fill="none"
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              {/* Left Bottom Leaf */}
              <path
                d="M178 275 C205 295 228 305 248 314 C215 310 195 298 178 275 Z"
                fill="none"
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinejoin="round"
              />

              {/* Right Top Leaf */}
              <path
                d="M358 192 C310 220 275 240 252 310 C290 270 330 240 358 192 Z"
                fill="none"
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              {/* Right Middle Leaf */}
              <path
                d="M346 235 C305 260 280 280 252 312 C295 295 320 270 346 235 Z"
                fill="none"
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              {/* Right Bottom Leaf */}
              <path
                d="M322 275 C295 295 272 305 252 314 C285 310 305 298 322 275 Z"
                fill="none"
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinejoin="round"
              />
            </g>

            {/* --- Lower Ribbon Banner: 'POLICE AROUND TOWN' --- */}
            <g filter="url(#pat-neon-glow)">
              {/* Ribbon Banner Body */}
              <path
                d="M90 350 L115 340 L385 340 L410 350 L395 385 L375 375 L125 375 L105 385 Z"
                fill="#050811"
                stroke="#ffffff"
                strokeWidth="4.5"
                strokeLinejoin="round"
              />
              {/* Ribbon Fold Tails */}
              <path d="M90 350 L75 365 L105 385 Z" fill="#0f172a" stroke="#ffffff" strokeWidth="3" />
              <path d="M410 350 L425 365 L395 385 Z" fill="#0f172a" stroke="#ffffff" strokeWidth="3" />

              {/* Ribbon Header Text: POLICE AROUND TOWN */}
              <text
                x="250"
                y="367"
                textAnchor="middle"
                fill="#ffffff"
                stroke="#ffffff"
                strokeWidth="1.2"
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="900"
                fontSize="22"
                letterSpacing="2.5"
              >
                POLICE AROUND TOWN
              </text>
            </g>

            {/* Light Sweep Sheen directly mapped to shield clip */}
            {animate && lightSweep && (
              <g clipPath="url(#pat-shield-clip)">
                <rect
                  x="-200"
                  y="0"
                  width="200"
                  height="500"
                  fill="url(#pat-metal-bevel-grad)"
                  opacity="0.3"
                  className="pat-light-sweep-svg"
                />
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};
