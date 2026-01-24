import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

const TRANSLATION_KEY = 'sacred_translation';

export const SettingsProvider = ({ children }) => {
  const [translation, setTranslation] = useState(() => {
    const stored = localStorage.getItem(TRANSLATION_KEY);
    // Default to ESV if no preference saved
    return stored || 'esv';
  });

  useEffect(() => {
    localStorage.setItem(TRANSLATION_KEY, translation);
  }, [translation]);

  return (
    <SettingsContext.Provider value={{ translation, setTranslation }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
