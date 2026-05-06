import { useAppStore } from '../store/useAppStore';
import { translations } from '../i18n';

export const useTranslation = () => {
  const language = useAppStore(state => state.language);
  const t = translations[language as keyof typeof translations] || translations.ja;
  return { t, language };
};
