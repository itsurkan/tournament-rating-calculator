import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from '@/lib/i18n'
import { ThemeProvider } from '@/lib/theme'

// Runs before first paint to set the theme class from the stored choice (or the
// system preference), so there is no flash of the wrong theme. Mirrors
// applyTheme() in lib/theme.tsx.
const themeScript = `
(function(){try{
  var m = localStorage.getItem('theme');
  var dark = m === 'dark' || ((m === 'system' || !m) && matchMedia('(prefers-color-scheme: dark)').matches);
  var c = document.documentElement.classList;
  c.add(dark ? 'dark' : 'light');
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}catch(e){}})();
`

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: '\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440 \u0440\u0435\u0439\u0442\u0438\u043d\u0433\u0443 Ligas',
  description:
    '\u0412\u0441\u0442\u0430\u0432\u0442\u0435 \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f \u043d\u0430 \u0442\u0443\u0440\u043d\u0456\u0440 \u0437 ligas.io \u0442\u0430 \u043c\u0438\u0442\u0442\u0454\u0432\u043e \u0440\u043e\u0437\u0440\u0430\u0445\u0443\u0439\u0442\u0435 \u0437\u043c\u0456\u043d\u0443 \u0440\u0435\u0439\u0442\u0438\u043d\u0433\u0443 \u0437 \u043d\u0430\u0441\u0442\u0456\u043b\u044c\u043d\u043e\u0433\u043e \u0442\u0435\u043d\u0456\u0441\u0443 \u0434\u043b\u044f \u043a\u043e\u0436\u043d\u043e\u0433\u043e \u0433\u0440\u0430\u0432\u0446\u044f \u2014 \u0431\u0435\u0437 \u043e\u0447\u0456\u043a\u0443\u0432\u0430\u043d\u043d\u044f \u043e\u0431\u0440\u043e\u0431\u043a\u0438 \u0432\u0456\u0434 ligas.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1b1f' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="uk"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-background text-foreground">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
