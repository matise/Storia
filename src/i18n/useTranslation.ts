import { DICTIONARY, TranslationDictionary } from './dictionary';
import { useStoriaStore } from '../store/useStoriaStore';
import { SupportedLanguage } from '../types/storia';

export function useTranslation() {
  const uiLanguage = useStoriaStore((state) => state.appSettings.uiLanguage);
  const setUiLanguage = useStoriaStore((state) => state.setUiLanguage);

  const dict: TranslationDictionary = DICTIONARY[uiLanguage] ?? DICTIONARY.en;

  const t = <K extends keyof TranslationDictionary>(key: K): TranslationDictionary[K] => {
    return dict[key];
  };

  const toggleLanguage = () => {
    const next: SupportedLanguage = uiLanguage === 'en' ? 'hr' : 'en';
    setUiLanguage(next);
  };

  return {
    t,
    uiLanguage,
    setUiLanguage,
    toggleLanguage,
  };
}

