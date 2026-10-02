/*
 * Bibliothèque d'interface Captivia (« carnet de terrain »). Contrat : frontend/docs/DESIGN.md.
 * Les composants n'emploient que les jetons sémantiques (bg-paper, text-ink…) : pas de `dark:`.
 */
export { default as Button, buttonClasses } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize, ButtonStyleOptions } from './Button';
export { default as Field } from './Field';
export type { FieldProps, FieldControlProps } from './Field';
export { default as Card } from './Card';
export type { CardProps } from './Card';
export {
  default as Badge,
  IucnBadge,
  IucnScale,
  IUCN_CATEGORIES,
  IUCN_SCALE,
  IUCN_CHIP_CLASSES,
  toIucnCategory,
} from './Badge';
export type { BadgeProps, BadgeTone, IucnCategory, IucnBadgeProps, IucnScaleProps } from './Badge';
export { default as EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
export { default as Skeleton, SkeletonText, SkeletonGroup } from './Skeleton';
export type { SkeletonProps, SkeletonGroupProps } from './Skeleton';
export { default as SectionHeader } from './SectionHeader';
export type { SectionHeaderProps } from './SectionHeader';
export { default as CareTimeline } from './CareTimeline';
export type { CareTimelineProps, CareTimelineItem, CareStatus } from './CareTimeline';
export { default as AnimalSilhouette, silhouetteKindOf } from './AnimalSilhouette';
export type { AnimalSilhouetteProps, SilhouetteKind } from './AnimalSilhouette';
export { BrandMark } from './BrandMark';
export { cx } from './cx';
export { default as Modal } from './Modal';
export type { ModalProps, ModalSize } from './Modal';
export { default as Spinner, LoadingPage } from './Spinner';
export { default as ErrorBoundary } from './ErrorBoundary';
export { default as Toast } from './Toast';
export { default as Figure } from './Figure';
export type { FigureProps, FigureRatio, PhotoCredit } from './Figure';
export { default as Alert } from './Alert';
export type { AlertProps, AlertSeverity } from './Alert';
export { default as Tip } from './Tip';
export type { TipProps } from './Tip';
export { default as MediaCard } from './MediaCard';
export type { MediaCardProps } from './MediaCard';
export { default as AnimalCard } from './AnimalCard';
export type { AnimalCardProps, AnimalFact } from './AnimalCard';
export { TaskPill, PremiumBadge } from './Pills';
export type { TaskPillProps } from './Pills';
export { LockedSlot, GuestBanner, Steps } from './Offer';
export type { LockedSlotProps, GuestBannerProps, StepsProps } from './Offer';
