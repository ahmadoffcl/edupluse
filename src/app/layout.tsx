import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WelcomeIntro } from "@/components/brand/welcome-intro";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "EduPulse | Next-generation education platform",
    template: "%s | EduPulse",
  },
  description:
    "A premium multi-tenant education platform for schools, academies, coaching centers, and online classes.",
  metadataBase: new URL("https://edupulse.vercel.app"),
  icons: {
    icon: "/edupulse-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var p=location.pathname;var auth=p==='/login'||p==='/signup'||p==='/reset-password';if(!auth&&sessionStorage.getItem('edupulse.welcome.seen')!=='true'){document.documentElement.classList.add('edupulse-welcome-pending');}}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <div id="edupulse-app-content">
            <AuthProvider>{children}</AuthProvider>
          </div>
          <WelcomeIntro />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
