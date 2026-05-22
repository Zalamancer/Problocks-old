import { useEffect } from 'react';
import { useStudio } from '@/store/studio-store';

export function useThemeEffect() {
  const { theme } = useStudio();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light');
    if (theme === 'light') {
      root.classList.add('light');
    }
  }, [theme]);
}
