/**
 * Événement « un soin à rappeler vient d'être créé » (routine, médicament, vaccin, rendez-vous),
 * émis par `api.ts` après une création réussie. Dans l'app native, le pont l'écoute pour
 * reprogrammer les rappels de l'appareil, ou proposer les notifications (explication puis
 * permission) au premier rappel créé (W6-07). Sur le web, personne ne l'écoute.
 */
export const CARE_SCHEDULED_EVENT = 'captivia:care-scheduled';

export function notifyCareScheduled(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event(CARE_SCHEDULED_EVENT));
  } catch {
    // environnement sans Event constructible : sans conséquence
  }
}
