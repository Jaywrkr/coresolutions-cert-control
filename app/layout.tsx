import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoreCert | Coresolutions",
  description: "Control de certificaciones y requisitos por marca",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
