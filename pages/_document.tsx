import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  const siteUrl = process.env.NEXTAUTH_URL || 'https://toopil.com';
  const siteName = 'Toopil';
  const description = 'Plateforme de pronostics sportifs pour le football et le rugby. Relevez des défis, rivalisez avec vos amis et devenez le meilleur pronostiqueur !';
  
  return (
    <Html lang="fr">
      <Head>
        <meta name="description" content={description} />
        
        {/* Favicon - Using optimized favicon files */}
        <link rel="shortcut icon" href="/favicon.ico?t=20250115" type="image/x-icon" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?t=20250115" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png?t=20250115" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo.png?t=20250115" />
        <meta name="msapplication-TileImage" content="/favicon-32.png?t=20250115" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:title" content={siteName} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={`${siteUrl}/og-image.png?v=20250115`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content={`${siteName} - Logo`} />
        <meta property="og:site_name" content={siteName} />
        <meta property="og:locale" content="fr_FR" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={siteUrl} />
        <meta name="twitter:title" content={siteName} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={`${siteUrl}/og-image.png?v=20250115`} />
        <meta name="twitter:image:alt" content={`${siteName} - Logo`} />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
