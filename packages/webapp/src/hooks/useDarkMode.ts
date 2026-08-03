// @ts-nocheck
import { css } from '@emotion/css';
import { useTheme } from '@/context/theme/ThemeProvider';

export const useIsDarkMode = () => {
  const { isDark } = useTheme();
  return isDark;
};

export const darkMode = (styles: string) => css`
  .bp4-dark & {
    ${styles}
  }
`;
