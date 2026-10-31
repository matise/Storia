import { TtsEngineProvider } from '../../types/storia';

const API_KEY_STORAGE_KEY = 'storia_byok_gemini_key_v1';
const TTS_PROVIDER_STORAGE_KEY = 'storia_tts_provider_v1';

function encodeStoredKey(rawKey: string): string {
  try {
    return btoa(encodeURIComponent(rawKey.trim()));
  } catch {
    return rawKey.trim();
  }
}

function decodeStoredKey(encoded: string): string {
  try {
    return decodeURIComponent(atob(encoded));
  } catch {
    return encoded;
  }
}

export function getApiKey(): string {
  try {
    const raw = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (!raw) return '';
    return decodeStoredKey(raw);
  } catch {
    return '';
  }
}

export function setApiKey(apiKey: string): void {
  try {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      return;
    }
    localStorage.setItem(API_KEY_STORAGE_KEY, encodeStoredKey(trimmed));
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function hasValidApiKey(): boolean {
  const key = getApiKey();
  return key.length >= 16;
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
}

/**
 * Returns the active TTS Engine Provider:
 * - 'gemini_tts' (Gemini 2.5 Flash Preview TTS)
 * - 'browser_tts' (Local Browser Web Speech API SpeechSynthesis)
 */
export function getTtsProvider(): TtsEngineProvider {
  try {
    const val = localStorage.getItem(TTS_PROVIDER_STORAGE_KEY);
    if (val === 'gemini_tts' || val === 'browser_tts') {
      return val;
    }
    return hasValidApiKey() ? 'gemini_tts' : 'browser_tts';
  } catch {
    return 'browser_tts';
  }
}

export function setTtsProvider(provider: TtsEngineProvider): void {
  try {
    localStorage.setItem(TTS_PROVIDER_STORAGE_KEY, provider);
  } catch {
    // Ignore
  }
}

// Backward-compatible helpers mapped to browser_tts alternative
export function getUseProceduralFallback(): boolean {
  return getTtsProvider() === 'browser_tts';
}

export function setUseProceduralFallback(enabled: boolean): void {
  setTtsProvider(enabled ? 'browser_tts' : 'gemini_tts');
}
