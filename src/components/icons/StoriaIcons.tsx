import React from 'react';

export interface StoriaIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  variant?: 'color' | 'mono'; // 'color' uses the vibrant storybook palette, 'mono' uses currentColor
  accentColor?: string; // Optional dynamic tint override
}

/**
 * Palette inspired by the illuminated storybook visual design:
 * Deep Slate midnight base with glowing Cerulean, Saffron, Magenta, Emerald, Violet & Cyan.
 */
export const STORIA_PALETTE = {
  bg: '#0a0f1d',
  bookBlue: '#0ea5e9', // Cerulean
  bookBlueDark: '#0369a1',
  bookPages: '#38bdf8',
  pageText: '#e0f2fe',
  saffron: '#facc15', // Golden Yellow "S"
  saffronDark: '#eab308',
  magenta: '#f43f5e', // Rose/Magenta swirl
  emerald: '#10b981', // Forest/Emerald swirl
  violet: '#a855f7', // Mystic Violet swirl
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  amber: '#f59e0b',
  outline: '#1e293b',
  white: '#ffffff',
} as const;

/**
 * 1. StoriaAppBrandIcon
 * The flagship master brand icon inspired directly by the artwork:
 * An illuminated open storybook with colorful swooshes, dynamic audio/speech swirls,
 * typographic letters (A, B, C, S) ascending into sound waves.
 */
export const StoriaAppBrandIcon: React.FC<StoriaIconProps> = ({
  size = 32,
  className = '',
  variant = 'color',
  ...props
}) => {
  if (variant === 'mono') {
    return (
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        <path d="M4 36c6-2 14-2 20 2 6-4 14-4 20-2V10c-6-2-14-2-20 2-6-4-14-4-20-2v26z" />
        <path d="M24 12v26" />
        <path d="M26 18c0-3.5-4-3.5-4 0 0 4.5 4 4.5 4 8 0 3.5-4 3.5-4 0" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="storia-bg-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f172a" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="storia-book-grad" x1="10" y1="36" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0284c7" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="storia-saffron-grad" x1="26" y1="8" x2="38" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde047" />
          <stop offset="1" stopColor="#eab308" />
        </linearGradient>
      </defs>

      {/* Rounded App Icon Container Badge */}
      <rect width="64" height="64" rx="14" fill="url(#storia-bg-grad)" stroke="#1e293b" strokeWidth="1.5" />

      {/* Background magical swirls */}
      <path
        d="M22 26c-5-6-2-14 5-15s10 4 8 10c-1 3-3 5-3 5"
        stroke={STORIA_PALETTE.violet}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M42 28c4-5 8-4 9 1s-4 9-9 8"
        stroke={STORIA_PALETTE.magenta}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M17 38c-4-4-6-10-1-13s9 3 7 7"
        stroke={STORIA_PALETTE.cyan}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M45 36c4 3 7 7 6 11s-7 4-10 1"
        stroke={STORIA_PALETTE.emerald}
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Floating Letters (A, B, C, e, k) floating like in the artwork */}
      <text x="32" y="9" fill={STORIA_PALETTE.saffron} fontSize="6" fontFamily="sans-serif" fontWeight="900" textAnchor="middle">A</text>
      <text x="42" y="12" fill={STORIA_PALETTE.emerald} fontSize="5.5" fontFamily="sans-serif" fontWeight="800">B</text>
      <text x="50" y="18" fill={STORIA_PALETTE.saffron} fontSize="5.5" fontFamily="sans-serif" fontWeight="800">C</text>
      <text x="14" y="24" fill={STORIA_PALETTE.white} fontSize="5" fontFamily="sans-serif" fontWeight="700">e</text>
      <text x="52" y="27" fill={STORIA_PALETTE.white} fontSize="5" fontFamily="sans-serif" fontWeight="700">k</text>

      {/* Flagship Saffron "S" Swirl Centerpiece */}
      <path
        d="M36 17.5c-1.5-2.2-4.5-2.5-6.5-1-2 1.5-2 4 0 5.5 3 2.2 4.5 3.5 4.5 6.5 0 3.5-3 5.5-6.5 5-2.5-.4-4-2-4.5-3.5"
        stroke="url(#storia-saffron-grad)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* The Open Storybook Base */}
      {/* Outer book cover */}
      <path
        d="M11 40c6.5-2 14-2.5 21 1.5 7-4 14.5-3.5 21-1.5v15c-6.5-2-14-1.5-21 2-7-3.5-14.5-4-21-2v-15z"
        fill="url(#storia-book-grad)"
        stroke="#0c4a6e"
        strokeWidth="1.5"
      />
      {/* Book spine curve */}
      <path d="M32 41.5v17" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" />

      {/* Left and Right Page Linework (Spoken text & audio lines) */}
      <path d="M16 45c3.5-1 8-1 12 1M16 48.5c3.5-1 8-1 12 1M16 52c3-1 6.5-1 10 0.8" stroke="#e0f2fe" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M36 46c4-1 8.5-1 12 0.8M36 49.5c4-1 8.5-1 12 0.8M36 53c3-0.8 6.5-0.8 10 0.8" stroke="#e0f2fe" strokeWidth="1.6" strokeLinecap="round" />

      {/* Bottom Swirl Flourishes (Magenta & Emerald) */}
      <path d="M11 48c-3 2-3 7 1 7s5-2 5-5" stroke={STORIA_PALETTE.magenta} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M53 49c3 1 4 6 1 8s-6 1-7-3" stroke={STORIA_PALETTE.emerald} strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
};

/**
 * 2. StorybookIcon
 * Open script/book with glowing story lines and subtle magic arc.
 */
export const StorybookIcon: React.FC<StoriaIconProps> = ({
  size = 24,
  className = '',
  variant = 'color',
  ...props
}) => {
  const stroke = variant === 'color' ? STORIA_PALETTE.bookBlue : 'currentColor';
  const accent = variant === 'color' ? STORIA_PALETTE.saffron : 'currentColor';
  const pageLine = variant === 'color' ? '#bae6fd' : 'currentColor';

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      {...props}
    >
      <path
        d="M4 22c4.5-1.5 8.5-1.5 12 1 3.5-2.5 7.5-2.5 12-1v-12c-4.5-1.5-8.5-1.5-12 1-3.5-2.5-7.5-2.5-12-1v12z"
        fill={variant === 'color' ? '#0369a1' : 'none'}
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 11v12" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 14h5M7 17h5M7 20h3M20 14h5M20 17h5M20 20h4" stroke={pageLine} strokeWidth="1.4" strokeLinecap="round" />
      {/* Magic ascending spark */}
      <circle cx="16" cy="6" r="1.5" fill={accent} />
      <path d="M13 7.5c1.5-1.5 4.5-1.5 6 0" stroke={accent} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
};

/**
 * 3. AudioDramaWaveIcon
 * Combines an acoustic speech sound wave with the playful storybook spiral flourishes.
 */
export const AudioDramaWaveIcon: React.FC<StoriaIconProps> = ({
  size = 24,
  className = '',
  variant = 'color',
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      {...props}
    >
      {/* Waveform bars */}
      <rect x="4" y="13" width="2" height="6" rx="1" fill={variant === 'color' ? STORIA_PALETTE.bookBlue : 'currentColor'} />
      <rect x="8" y="9" width="2" height="14" rx="1" fill={variant === 'color' ? STORIA_PALETTE.emerald : 'currentColor'} />
      <rect x="12" y="5" width="2" height="22" rx="1" fill={variant === 'color' ? STORIA_PALETTE.saffron : 'currentColor'} />
      <rect x="16" y="8" width="2" height="16" rx="1" fill={variant === 'color' ? STORIA_PALETTE.magenta : 'currentColor'} />
      <rect x="20" y="6" width="2" height="20" rx="1" fill={variant === 'color' ? STORIA_PALETTE.violet : 'currentColor'} />
      <rect x="24" y="11" width="2" height="10" rx="1" fill={variant === 'color' ? STORIA_PALETTE.cyan : 'currentColor'} />
      <rect x="28" y="14" width="2" height="4" rx="1" fill={variant === 'color' ? STORIA_PALETTE.bookBlue : 'currentColor'} />
      {/* Story spiral top sweep */}
      <path
        d="M8 7c3-3 8-3 12 0"
        stroke={variant === 'color' ? STORIA_PALETTE.saffron : 'currentColor'}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * 4. SpeakerPersonaIcon
 * Distinctive character silhouette surrounded by acting flourish spirals.
 */
export const SpeakerPersonaIcon: React.FC<StoriaIconProps> = ({
  size = 24,
  className = '',
  variant = 'color',
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      {...props}
    >
      <circle
        cx="16"
        cy="11"
        r="5"
        fill={variant === 'color' ? '#1e293b' : 'none'}
        stroke={variant === 'color' ? STORIA_PALETTE.saffron : 'currentColor'}
        strokeWidth="2"
      />
      <path
        d="M8 25c0-4.4 3.6-7 8-7s8 2.6 8 7"
        stroke={variant === 'color' ? STORIA_PALETTE.bookBlue : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Playful vocal aura curls */}
      <path
        d="M24 10c2-1 4 1 3 3"
        stroke={variant === 'color' ? STORIA_PALETTE.magenta : 'currentColor'}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M26 7c3-2 6 1 4 5"
        stroke={variant === 'color' ? STORIA_PALETTE.emerald : 'currentColor'}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * 5. MagicTtsSparkleIcon
 * Dual AI sparkle with glowing storybook swirl tail.
 */
export const MagicTtsSparkleIcon: React.FC<StoriaIconProps> = ({
  size = 24,
  className = '',
  variant = 'color',
  ...props
}) => {
  const saffron = variant === 'color' ? STORIA_PALETTE.saffron : 'currentColor';
  const magenta = variant === 'color' ? STORIA_PALETTE.magenta : 'currentColor';
  const cyan = variant === 'color' ? STORIA_PALETTE.cyan : 'currentColor';

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      {...props}
    >
      {/* Primary 4-pointed star */}
      <path
        d="M16 4c0 6-3 9-9 9 6 0 9 3 9 9 0-6 3-9 9-9-6 0-9-3-9-9z"
        fill={saffron}
      />
      {/* Secondary sparkle */}
      <path
        d="M25 19c0 3-1.5 4.5-4.5 4.5 3 0 4.5 1.5 4.5 4.5 0-3 1.5-4.5 4.5-4.5-3 0-4.5-1.5-4.5-4.5z"
        fill={magenta}
      />
      {/* Ambient acoustic trail swirl */}
      <path
        d="M7 23c4-1 6 3 9 2"
        stroke={cyan}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * 6. SoundEffectFoleyIcon
 * Dynamic impact & environmental sound symbol (thunder / shockwave + swoosh).
 */
export const SoundEffectFoleyIcon: React.FC<StoriaIconProps> = ({
  size = 24,
  className = '',
  variant = 'color',
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      {...props}
    >
      {/* SFX impact lightning */}
      <path
        d="M17 4l-7 12h6l-3 12 11-14h-6l5-10z"
        fill={variant === 'color' ? STORIA_PALETTE.saffron : 'none'}
        stroke={variant === 'color' ? STORIA_PALETTE.saffronDark : 'currentColor'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Acoustic dispersion rings */}
      <path
        d="M24 10c3 3 3 8 0 11"
        stroke={variant === 'color' ? STORIA_PALETTE.magenta : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 12c-2 2-2 6 0 8"
        stroke={variant === 'color' ? STORIA_PALETTE.emerald : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * 7. MasterBroadcastDiskIcon
 * High-resolution master export record / vinyl disk with broadcast waves.
 */
export const MasterBroadcastDiskIcon: React.FC<StoriaIconProps> = ({
  size = 24,
  className = '',
  variant = 'color',
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      {...props}
    >
      <circle
        cx="16"
        cy="16"
        r="12"
        fill={variant === 'color' ? '#0f172a' : 'none'}
        stroke={variant === 'color' ? STORIA_PALETTE.bookBlue : 'currentColor'}
        strokeWidth="2"
      />
      <circle cx="16" cy="16" r="7" stroke={variant === 'color' ? '#334155' : 'currentColor'} strokeWidth="1.2" />
      <circle cx="16" cy="16" r="3" fill={variant === 'color' ? STORIA_PALETTE.saffron : 'currentColor'} />
      {/* Broadcast radiating beam */}
      <path
        d="M26 6c3 3 3 8 0 11"
        stroke={variant === 'color' ? STORIA_PALETTE.emerald : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * 8. ScriptDoctorQuillIcon
 * Quill pen writing illuminated script text with ink droplet flourish.
 */
export const ScriptDoctorQuillIcon: React.FC<StoriaIconProps> = ({
  size = 24,
  className = '',
  variant = 'color',
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      {...props}
    >
      {/* Feather quill */}
      <path
        d="M26 5c-7 2-13 7-16 14l-2 7 7-2c7-3 12-9 14-16l-3-3z"
        fill={variant === 'color' ? '#0c4a6e' : 'none'}
        stroke={variant === 'color' ? STORIA_PALETTE.bookBlue : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 19l8-8" stroke={variant === 'color' ? STORIA_PALETTE.saffron : 'currentColor'} strokeWidth="1.8" />
      {/* Splashing ink flourish */}
      <circle cx="6" cy="27" r="1.5" fill={variant === 'color' ? STORIA_PALETTE.magenta : 'currentColor'} />
    </svg>
  );
};

/**
 * 9. BilingualGlobeBookIcon
 * Cultural language adaptation symbol (bilingual speech bubbles & storybook).
 */
export const BilingualGlobeBookIcon: React.FC<StoriaIconProps> = ({
  size = 24,
  className = '',
  variant = 'color',
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      {...props}
    >
      <circle
        cx="16"
        cy="16"
        r="11"
        stroke={variant === 'color' ? STORIA_PALETTE.bookBlue : 'currentColor'}
        strokeWidth="2"
      />
      <path
        d="M5 16h22M16 5c3 3.5 4.5 7.5 4.5 11s-1.5 7.5-4.5 11c-3-3.5-4.5-7.5-4.5-11s1.5-7.5 4.5-11z"
        stroke={variant === 'color' ? '#0284c7' : 'currentColor'}
        strokeWidth="1.4"
      />
      {/* EN / HR badge flourish */}
      <path
        d="M20 7c2-2 5-1 5 2s-3 3-5 3"
        stroke={variant === 'color' ? STORIA_PALETTE.saffron : 'currentColor'}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * 10. FlagCroatia
 * Crisp, authentic vector flag of the Republic of Croatia (3:2 ratio)
 * Red, white, and blue tricolor with stylized central coat of arms (šahovnica).
 */
export const FlagCroatia: React.FC<{
  className?: string;
  size?: number | string;
  title?: string;
}> = ({ className = 'w-4.5 h-3', size, title = 'Hrvatska (HR)' }) => (
  <svg
    viewBox="0 0 30 20"
    width={size ? (typeof size === 'number' ? size * 1.5 : size) : undefined}
    height={size ?? undefined}
    className={`inline-block overflow-hidden rounded-[2px] shadow-xs shrink-0 select-none ${className}`}
    aria-label={title}
    role="img"
  >
    <title>{title}</title>
    {/* Red top stripe */}
    <rect width="30" height="6.67" y="0" fill="#FF0000" />
    {/* White middle stripe */}
    <rect width="30" height="6.67" y="6.67" fill="#FFFFFF" />
    {/* Blue bottom stripe */}
    <rect width="30" height="6.67" y="13.33" fill="#003893" />
    {/* Croatian Shield & Crown */}
    <g transform="translate(10.75, 3.2)">
      {/* Historical crown arches */}
      <path
        d="M0.5,2.6 L1.3,0.9 L2.3,2.6 L3.3,0.9 L4.3,2.6 L5.3,0.9 L6.3,2.6 L7.3,0.9 L8.0,2.6"
        fill="none"
        stroke="#003893"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      {/* Shield border */}
      <path
        d="M0.8,2.7 H7.7 V8.2 C7.7,10.8 4.25,12.2 4.25,12.2 C4.25,12.2 0.8,10.8 0.8,8.2 Z"
        fill="#FFFFFF"
        stroke="#003893"
        strokeWidth="0.6"
      />
      {/* 3x3 checkered red squares */}
      <rect x="1.5" y="3.3" width="1.75" height="1.6" fill="#FF0000" />
      <rect x="5.25" y="3.3" width="1.75" height="1.6" fill="#FF0000" />
      <rect x="3.375" y="4.9" width="1.75" height="1.6" fill="#FF0000" />
      <rect x="1.5" y="6.5" width="1.75" height="1.6" fill="#FF0000" />
      <rect x="5.25" y="6.5" width="1.75" height="1.6" fill="#FF0000" />
      <rect x="3.375" y="8.1" width="1.75" height="1.6" fill="#FF0000" />
    </g>
  </svg>
);

/**
 * 11. FlagUk
 * Crisp, authentic vector flag of the United Kingdom (Union Jack, 3:2 ratio)
 * Royal blue field, St Andrew/St Patrick saltires, and St George central cross.
 */
export const FlagUk: React.FC<{
  className?: string;
  size?: number | string;
  title?: string;
}> = ({ className = 'w-4.5 h-3', size, title = 'English (EN)' }) => (
  <svg
    viewBox="0 0 30 20"
    width={size ? (typeof size === 'number' ? size * 1.5 : size) : undefined}
    height={size ?? undefined}
    className={`inline-block overflow-hidden rounded-[2px] shadow-xs shrink-0 select-none ${className}`}
    aria-label={title}
    role="img"
  >
    <title>{title}</title>
    <defs>
      <clipPath id="uk-flag-clip-storia">
        <rect width="30" height="20" rx="2" />
      </clipPath>
    </defs>
    <g clipPath="url(#uk-flag-clip-storia)">
      <rect width="30" height="20" fill="#012169" />
      {/* White diagonal saltire */}
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#FFFFFF" strokeWidth="4" />
      {/* Red diagonal saltire */}
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" strokeWidth="2.2" />
      {/* White central cross */}
      <path d="M15,0 V20 M0,10 H30" stroke="#FFFFFF" strokeWidth="6" />
      {/* Red central cross */}
      <path d="M15,0 V20 M0,10 H30" stroke="#C8102E" strokeWidth="3.6" />
    </g>
  </svg>
);

/**
 * 12. StoriaFaviconIcon
 * Optimized micro-scale favicon symbol:
 * Bold golden "S" centerpiece with vibrant purple shadow, cyan audio wave,
 * rose/coral arc, and top emerald sparkle particle on deep slate midnight squircle.
 * Simplified for 16x16, 32x32, and 48x48 pixel grid clarity.
 */
export const StoriaFaviconIcon: React.FC<StoriaIconProps> = ({
  size = 32,
  className = '',
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="Storia Favicon Icon"
      {...props}
    >
      <defs>
        <linearGradient id="fav-bg-react" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f172a" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="fav-saffron-react" x1="12" y1="6" x2="20" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde047" />
          <stop offset="1" stopColor="#eab308" />
        </linearGradient>
        <filter id="fav-glow-react" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.8" stdDeviation="0.6" floodColor="#000000" floodOpacity="0.7" />
        </filter>
      </defs>

      {/* Deep Slate Midnight Squircle Badge */}
      <rect width="32" height="32" rx="7" fill="url(#fav-bg-react)" stroke="#1e293b" strokeWidth="1" />

      {/* Surrounding Magical Bits & Swirls */}
      {/* Top Violet Swirl */}
      <path d="M10 9.5c1.8-2.2 4.8-2.8 7.2-1.5" stroke="#a855f7" strokeWidth="2.2" strokeLinecap="round" />

      {/* Left Cyan Audio Arc */}
      <path d="M7.5 15c-.8-2.5 1-5 3.5-5.5" stroke="#06b6d4" strokeWidth="2.2" strokeLinecap="round" />

      {/* Right Rose / Coral Audio Arc */}
      <path d="M22.5 16.5c2.2 1.2 2.8 4 1.2 6" stroke="#f43f5e" strokeWidth="2.2" strokeLinecap="round" />

      {/* Bottom Emerald Loop */}
      <path d="M8.5 21c-1 2.2 1 4.5 3.5 4.5" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" />

      {/* Top Emerald Sparkle Bit (matching original artwork) */}
      <rect x="21" y="6" width="2.4" height="2.4" rx="0.5" fill="#10b981" transform="rotate(12 22 7)" />

      {/* Saffron Golden Particle */}
      <circle cx="25" cy="11.5" r="1.2" fill="#facc15" />

      {/* Micro-particles for high-DPI sparkle */}
      <circle cx="24.5" cy="15" r="0.9" fill="#f43f5e" />
      <circle cx="7.2" cy="12" r="0.8" fill="#38bdf8" />

      {/* Deep Violet Drop Shadow for Golden S */}
      <path
        d="M20.2 11.8c-1.2-1.8-3.6-2.2-5.4-1-1.8 1.2-1.8 3.2 0 4.6 2.6 1.8 3.8 2.8 3.8 5.4 0 2.8-2.4 4.5-5.2 4-2-.4-3.2-1.6-3.8-3"
        stroke="#7c3aed"
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Bold Central Golden S */}
      <path
        d="M20.5 11c-1.2-1.8-3.6-2.2-5.4-1-1.8 1.2-1.8 3.2 0 4.6 2.6 1.8 3.8 2.8 3.8 5.4 0 2.8-2.4 4.5-5.2 4-2-.4-3.2-1.6-3.8-3"
        stroke="url(#fav-saffron-react)"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#fav-glow-react)"
      />
    </svg>
  );
};

/**
 * Unified Icon Registry exporting all custom Storia symbols.
 */
export const StoriaIcons = {
  Brand: StoriaAppBrandIcon,
  Favicon: StoriaFaviconIcon,
  Storybook: StorybookIcon,
  AudioWave: AudioDramaWaveIcon,
  Persona: SpeakerPersonaIcon,
  MagicTts: MagicTtsSparkleIcon,
  FoleySfx: SoundEffectFoleyIcon,
  MasterExport: MasterBroadcastDiskIcon,
  ScriptDoctor: ScriptDoctorQuillIcon,
  Bilingual: BilingualGlobeBookIcon,
  FlagCroatia,
  FlagUk,
} as const;

export type StoriaIconName = keyof typeof StoriaIcons;

