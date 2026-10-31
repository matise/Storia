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
 * Unified Icon Registry exporting all custom Storia symbols.
 */
export const StoriaIcons = {
  Brand: StoriaAppBrandIcon,
  Storybook: StorybookIcon,
  AudioWave: AudioDramaWaveIcon,
  Persona: SpeakerPersonaIcon,
  MagicTts: MagicTtsSparkleIcon,
  FoleySfx: SoundEffectFoleyIcon,
  MasterExport: MasterBroadcastDiskIcon,
  ScriptDoctor: ScriptDoctorQuillIcon,
  Bilingual: BilingualGlobeBookIcon,
} as const;

export type StoriaIconName = keyof typeof StoriaIcons;

