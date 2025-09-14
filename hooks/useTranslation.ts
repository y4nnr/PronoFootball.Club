import { useRouter } from 'next/router';
import { useMemo, useCallback } from 'react';

export function useTranslation(namespace: string = 'common') {
  const router = useRouter();
  // Fallback to 'fr' if locale is undefined
  const locale = router.locale || 'fr';

  const translations = useMemo(() => {
    try {
      return require(`../public/locales/${locale}/${namespace}.json`);
    } catch (error) {
      console.error(`Failed to load translations for ${locale}/${namespace}:`, error);
      return {};
    }
  }, [locale, namespace]);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const keys = key.split('.');
    let translation = keys.reduce((obj, k) => obj?.[k], translations) || key;

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        translation = translation.replace(`{{${key}}}`, String(value));
      });
    }

    return translation;
  }, [translations]);

  return { t, locale };
} 