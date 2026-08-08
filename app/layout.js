import "./globals.css";

export const metadata = {
  title: "Euphoria Sports",
  description: "Live scores, results and club championship standings"
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
