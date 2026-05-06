import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Weekly',
  description: '10분 단위 위클리 타임블로킹 다이어리',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
