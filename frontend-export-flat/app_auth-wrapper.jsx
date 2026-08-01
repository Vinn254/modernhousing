'use client';
import AppHeader from './components/AppHeader';
import SessionTimeout from './components/SessionTimeout';
export default function AuthWrapper({ children }) {
    return (<>
      <AppHeader />
      <SessionTimeout />
      {children}
    </>);
}
