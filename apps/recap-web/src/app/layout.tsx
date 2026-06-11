import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Grimoire Archive",
  description: "Campaign recaps — relive every session",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          backgroundColor: "#1A1410",
          color: "#ECE3CF",
          fontFamily: "'Cormorant Garamond', Georgia, serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
