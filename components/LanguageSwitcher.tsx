import { useRouter } from 'next/router';

const LanguageSwitcher = () => {
  const router = useRouter();
  const { asPath } = router;

  const handleLanguageChange = (newLocale: string) => {
    router.push(asPath, asPath, { locale: newLocale });
  };

  const getFlag = (lng: string) => {
    const flags: { [key: string]: string } = {
      'en': '🇬🇧',
      'fr': '🇫🇷'
    };
    return flags[lng] || '🌐';
  };

  return null;
};

export default LanguageSwitcher; 