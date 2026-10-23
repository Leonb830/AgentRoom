import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AgentRoom — Your coding workspace",
  description: "A private workspace for persistent coding tasks, clear execution history, and reviewable changes."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
