'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { FloatingBoundaryContext } from '../lib/floating-boundary';
import { cn } from '../lib/utils';

/**
 * The design's modal (`secOpen`, `subModal` in the export): a 520px card on
 * the overlay holding a `DsModalHeader`, a `DsModalBody` and a
 * `DsModalFooter`. The shell stays mounted while what is inside it changes,
 * so a flow of steps swaps its header and body without the card re-opening.
 */
function DsModal({
  open,
  onOpenChange,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="ds-modal__overlay" />
        <DialogPrimitive.Popup className={cn('ds-modal', className)}>{children}</DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** An optional step eyebrow, the title and a muted line, beside the close button. */
function DsModalHeader({
  eyebrow,
  title,
  description,
  closeLabel = 'Close',
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  closeLabel?: string;
}) {
  return (
    <div className="ds-modal__head">
      <div className="ds-modal__titles">
        {eyebrow && <span className="ds-modal__eyebrow">{eyebrow}</span>}
        <DialogPrimitive.Title className="ds-modal__title">{title}</DialogPrimitive.Title>
        {description && (
          <DialogPrimitive.Description className="ds-modal__sub">
            {description}
          </DialogPrimitive.Description>
        )}
      </div>
      <DialogPrimitive.Close className="ds-icon-btn ds-icon-btn--ghost" aria-label={closeLabel}>
        <X className="size-5" />
      </DialogPrimitive.Close>
    </div>
  );
}

/**
 * The modal's middle: padded to the card's edges, and the one part that
 * scrolls. It is also the boundary a select or menu opened inside it stays
 * within, so an open list never covers the footer's actions.
 */
function DsModalBody({ className, ...props }: Omit<React.ComponentProps<'div'>, 'ref'>) {
  const [boundary, setBoundary] = React.useState<HTMLDivElement | null>(null);
  return (
    <FloatingBoundaryContext.Provider value={boundary}>
      <div ref={setBoundary} className={cn('ds-modal__body ds-scroll', className)} {...props} />
    </FloatingBoundaryContext.Provider>
  );
}

/**
 * The modal's footer, above a divider: `start` on the left (a Back link, a
 * summary), the actions on the right.
 */
function DsModalFooter({
  start,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { start?: React.ReactNode }) {
  return (
    <div className={cn('ds-modal__foot', className)} {...props}>
      {start ?? <span />}
      <div className="ds-modal__actions">{children}</div>
    </div>
  );
}

export { DsModal, DsModalBody, DsModalFooter, DsModalHeader };
