import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LivAround — Host-Led Short-Term Rentals",
  description: "The only platform where guests are accountable for how they leave.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
