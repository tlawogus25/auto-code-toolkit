import './globals.css';

export const metadata = {
  title: 'Omok Game',
  description: 'Real-time Omok (Five-in-a-Row) game',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <header className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Omok Game</h1>
            <p className="text-gray-600 mt-2">Real-time Five-in-a-Row</p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}