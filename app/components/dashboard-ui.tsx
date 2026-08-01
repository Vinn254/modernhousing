'use client';

import { ReactNode, useEffect, useState } from 'react';

type SectionCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

type StatCardProps = {
  title: string;
  value: ReactNode;
  caption: string;
  icon?: ReactNode;
  accent?: 'emerald' | 'indigo' | 'sky' | 'amber' | 'rose' | 'slate';
  trend?: ReactNode;
  onClick?: () => void;
};

type FormFieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
};

type PremiumTableProps = {
  headers: string[];
  children: ReactNode;
  emptyText?: string;
};

type DashboardHeaderProps = {
  title: string;
  subtitle: string;
  action?: ReactNode;
};

const accentClassMap = {
  emerald: 'accent-emerald',
  indigo: 'accent-indigo',
  sky: 'accent-sky',
  amber: 'accent-amber',
  rose: 'accent-rose',
  slate: 'accent-slate',
};

export function SectionCard({ title, subtitle, action, children, className }: SectionCardProps) {
  return (
    <section className={`panel-card ${className ?? ''}`.trim()}>
      <div className="panel-card__header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action ? <div className="panel-card__action">{action}</div> : null}
      </div>
      <div className="panel-card__body">{children}</div>
    </section>
  );
}

export function StatCard({ title, value, caption, icon, accent = 'slate', trend, onClick }: StatCardProps) {
  return (
    <article className={`bento-card ${accentClassMap[accent]}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick();
      }
    } : undefined}>
      <div className="bento-card__icon">{icon}</div>
      <div className="bento-card__content">
        <p className="card-label">{title}</p>
        <div className="bento-card__value">{value}</div>
        {trend ? <div className="bento-card__trend">{trend}</div> : null}
        <p className="bento-card__caption">{caption}</p>
      </div>
    </article>
  );
}

export function FormField({ label, children, hint }: FormFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function PremiumTable({ headers, children, emptyText }: PremiumTableProps) {
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {emptyText ? <div className="table-empty">{emptyText}</div> : null}
    </div>
  );
}

export function DashboardHeader({ title, subtitle, action }: DashboardHeaderProps) {
  return (
    <header className="dashboard-hero">
      <div>
        <p className="eyebrow">Premium operations workspace</p>
        <h1>{title}</h1>
        <p className="dashboard-hero__subtitle">{subtitle}</p>
      </div>
      {action ? <div className="dashboard-hero__actions">{action}</div> : null}
    </header>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('dashboard-theme') as 'light' | 'dark' | null;
    const resolvedTheme = savedTheme === 'dark' ? 'dark' : 'light';
    setTheme(resolvedTheme);
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    window.localStorage.setItem('dashboard-theme', nextTheme);
  };

  return (
    <button type="button" className="icon-button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
