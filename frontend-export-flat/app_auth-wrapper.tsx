'use client';
import AppHeader from './components/AppHeader';
import SessionTimeout from './components/SessionTimeout';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-wrapper">
      <AppHeader />
      <SessionTimeout />
      {children}
    </div>
  );
}