import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('rf-theme') || 'light';
  });
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rf-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    if (transitioning) return;
    setTransitioning(true);

    const newTheme = theme === 'light' ? 'dark' : 'light';
    const overlay = document.createElement('div');
    overlay.id = 'theme-wipe-overlay';

    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '99999',
      pointerEvents: 'none',
      background: newTheme === 'dark' ? '#111827' : '#f8faf9',
      clipPath: 'inset(0 100% 0 0)',
      transition: 'clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    });

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.style.clipPath = 'inset(0 0% 0 0)';
      });
    });

    setTimeout(() => {
      setTheme(newTheme);
    }, 200);

    setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease-out';
    }, 450);

    setTimeout(() => {
      overlay.remove();
      setTransitioning(false);
    }, 750);
  }, [theme, transitioning]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, transitioning }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
