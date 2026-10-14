import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Línea de Recuerdos",
  description: "Una línea de tiempo personal de recuerdos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans">{children}</body>
    </html>
  );
}
