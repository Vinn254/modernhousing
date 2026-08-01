import './globals.css';
import AuthWrapper from './auth-wrapper';
export const metadata = {
    title: 'Springfield Systems',
    description: 'Apartment management portal for project managers, agents, admins, and tenants',
};
export default function RootLayout({ children, }) {
    return (<html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      </head>
      <body>
        <AuthWrapper>{children}</AuthWrapper>
      </body>
    </html>);
}
