import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientProvider from "@/components/ClientProvider";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import PhoneFrame from "@/components/PhoneFrame";

export const metadata: Metadata = {
  title: "VORTIGEN | Smart Wind Monitoring",
  description: "Dashboard monitoring prototipe pembangkit listrik angin bladeless VORTIGEN.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vortigen",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0a",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans antialiased">
        <ServiceWorkerRegister />
        <ClientProvider>
          <PhoneFrame>{children}</PhoneFrame>
        </ClientProvider>
      </body>
    </html>
  );
}
