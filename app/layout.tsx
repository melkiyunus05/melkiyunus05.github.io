import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientProvider from "@/components/ClientProvider";
import PhoneFrame from "@/components/PhoneFrame";

export const metadata: Metadata = {
  title: "VORTIGEN | Smart Wind Monitoring",
  description: "Dashboard monitoring prototipe pembangkit listrik angin bladeless VORTIGEN.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans antialiased">
        <ClientProvider>
          <PhoneFrame>{children}</PhoneFrame>
        </ClientProvider>
      </body>
    </html>
  );
}
