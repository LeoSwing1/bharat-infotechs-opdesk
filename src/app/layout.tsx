import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"OPDesk — Workforce Operations", description:"Bharat Infotechs Workforce Operations" };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
