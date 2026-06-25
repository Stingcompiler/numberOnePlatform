import React, { createContext, useContext, useState } from 'react';
import { getThemeStyles } from '../theme/theme';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Enforce a sleek dark mode by default for premium branding
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const theme = getThemeStyles(isDark);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, theme, colors: theme.colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
