import type {
  CookieCategoryDefinition,
  CookieCategoryPreferences,
} from "@/lib/cookie-consent/types";

export const COOKIE_PREFERENCE_CATEGORIES: CookieCategoryDefinition[] = [
  {
    id: "necessary",
    title: "Strictly necessary",
    description:
      "Required for secure sign-in, short-lived OAuth connect cookies, and core Archive Cloud functionality. These cannot be disabled.",
    alwaysActive: true,
  },
  {
    id: "preferences",
    title: "Preferences",
    description:
      "Remember UI choices on this device such as sidebar state, file list/grid view, and language. Not used for advertising.",
  },
];

export const ALL_COOKIES_ACCEPTED: CookieCategoryPreferences = {
  necessary: true,
  preferences: true,
};

export const ALL_NON_ESSENTIAL_REJECTED: CookieCategoryPreferences = {
  necessary: true,
  preferences: false,
};
