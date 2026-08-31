export type ThemeOptions = {
  dark: string;
  light: string;
};

export interface SvglSvg {
  id: number;
  title: string;
  category: string | string[];
  route: string | ThemeOptions;
  url: string;
  wordmark?: string | ThemeOptions;
  brandUrl?: string;
}

export interface SvglCategory {
  category: string;
  total: number;
}
