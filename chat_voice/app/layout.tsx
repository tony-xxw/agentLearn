import './globals.css';

export const metadata = {
  title: 'Multimodal Chat Test',
  description: 'Test page for MultimodalChat component',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
