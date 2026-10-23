'use client';
import { Button as AriaButton, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { X, type LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { ControlLabelContext } from './select-control';

export function Button({
  variant = '',
  className = '',
  ...props
}: ComponentProps<typeof AriaButton> & { variant?: string }) {
  return <AriaButton {...props} className={`button ${variant} ${className}`} />;
}
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Field({
  label,
  id,
  hint,
  error,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <ControlLabelContext value={label}>{children}</ControlLabelContext>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}
export function DialogPanel({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      isDismissable
      className="dialog-overlay"
    >
      <Modal className="dialog">
        <Dialog>
          <div className="dialog-header">
            <Heading slot="title">{title}</Heading>
            <AriaButton onPress={onClose} className="icon-button" aria-label="Cerrar">
              <X size={21} />
            </AriaButton>
          </div>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon size={38} />
      <h2>{title}</h2>
      <p className="muted">{children}</p>
      {action}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  illustration,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  illustration?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className={`page-heading${illustration ? ' page-heading-illustrated' : ''}`}>
      <div className="page-heading-copy">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="row">{children}</div>}
      {illustration && (
        <div className="page-heading-art" aria-hidden="true">
          {illustration}
        </div>
      )}
    </header>
  );
}
