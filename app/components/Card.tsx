'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Tone = 'default' | 'accent' | 'info' | 'warning' | 'danger';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  hoverable?: boolean;
  padded?: boolean;
}

export function Card({
  title,
  subtitle,
  icon,
  tone = 'default',
  action,
  children,
  className = '',
  hoverable = true,
  padded = true,
}: CardProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.12 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const classes = [
    'ui-card',
    `ui-card--${tone}`,
    hoverable ? 'ui-card--hover' : '',
    padded ? 'ui-card--padded' : '',
    shown ? 'is-visible' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article ref={ref} className={classes}>
      {(icon || title) && (
        <header className="ui-card__head">
          {icon && <span className="ui-card__icon" aria-hidden="true">{icon}</span>}
          <div className="ui-card__titles">
            {title && <h3 className="ui-card__title">{title}</h3>}
            {subtitle && <p className="ui-card__subtitle">{subtitle}</p>}
          </div>
          {action && <div className="ui-card__action">{action}</div>}
        </header>
      )}
      {children && <div className="ui-card__body">{children}</div>}
    </article>
  );
}

export default Card;
