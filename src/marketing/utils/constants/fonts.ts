import { Inter, Manrope } from "next/font/google";

export const aeonik = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-aeonik",
});

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
