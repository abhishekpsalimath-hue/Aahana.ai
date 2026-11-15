import "./globals.css";

export const metadata = {
  title: "Aahana — Think beyond",
  description: "A general-purpose AI workspace to solve, create, write, build and improve.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
