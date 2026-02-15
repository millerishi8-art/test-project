import { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'app-language';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'he';
    } catch {
      return 'he';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {}
  }, [language]);

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'he' ? 'en' : 'he'));
  };

  const isHebrew = language === 'he';
  const isEnglish = language === 'en';

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, toggleLanguage, isHebrew, isEnglish }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
