import type { Metadata, Viewport } from "next";
import ServiceWorker from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Línea de Recuerdos",
  description: "Una línea de tiempo personal de recuerdos. Todo se guarda en tu dispositivo.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Recuerdos",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
