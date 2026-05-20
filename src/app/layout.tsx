import type { Metadata } from 'next';
import { Inter, Public_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import '@/components/familyExplorer/family-explorer.css';
import { AuthContextProvider } from '@/context/AuthContext';

const inter = Inter({ subsets: ['latin'] });
const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans' });
const instrumentSerif = Instrument_Serif({ weight: '400', subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-instrument-serif' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: 'Family Tree App',
  description: 'Visualize your family history',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${publicSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
        <AuthContextProvider>
          <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
            {children}
          </div>
        </AuthContextProvider>
      </body>
    </html>
  );
}
