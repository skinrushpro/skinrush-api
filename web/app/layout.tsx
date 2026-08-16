import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "SkinRush",
    template: "%s | SkinRush",
  },
  description: "Explore the SkinRush CS2 skin catalogue.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
