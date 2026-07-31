'use client';

import * as React from 'react';
import { cn } from '../lib';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-line bg-white shadow-card', className)}
      {...props}
    />
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const inputId = id ?? React.useId();
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        className={cn(
          'h-11 w-full rounded-lg border bg-white px-3 text-[15px] text-ink',
          'placeholder:text-ink-muted/60 e3-focus',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      {!error && hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, id, ...props },
  ref,
) {
  const areaId = id ?? React.useId();
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={areaId} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={areaId}
        className={cn(
          'min-h-[104px] w-full rounded-lg border bg-white p-3 text-[15px] text-ink e3-focus',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, id, children, ...props },
  ref,
) {
  const selectId = id ?? React.useId();
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          'h-11 w-full rounded-lg border bg-white px-3 text-[15px] text-ink e3-focus',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
});

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'info';
}) {
  const tones = {
    neutral: 'bg-surface text-ink-muted',
    primary: 'bg-primary text-ink',
    success: 'bg-success/10 text-success',
    danger: 'bg-danger/10 text-danger',
    warning: 'bg-warning/15 text-warning',
    info: 'bg-info/10 text-info',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = (name ?? '؟').trim().charAt(0);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-ink-muted',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {src ? (
        <img src={src} alt={name ?? ''} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="font-bold">{initial}</span>
      )}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-md bg-[linear-gradient(90deg,#EFEFEF_0px,#F7F7F7_200px,#EFEFEF_400px)] bg-[length:800px_100%]',
        className,
      )}
      aria-hidden
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-white px-6 py-14 text-center">
      {icon ? <div className="text-ink-muted">{icon}</div> : null}
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="جارٍ التحميل"
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent',
        className,
      )}
    />
  );
}
