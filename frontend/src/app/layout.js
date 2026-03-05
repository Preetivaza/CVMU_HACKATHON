import "./globals.css";
import ConditionalShell from "@/components/ConditionalShell";

export const metadata = {
  title: "SadakSurksha — Road Safety Management Platform",
  description: "AI-powered road damage detection, risk scoring, and infrastructure management for governments and municipalities.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body>
        <ConditionalShell>{children}</ConditionalShell>
      </body>
    </html>
  );
}
