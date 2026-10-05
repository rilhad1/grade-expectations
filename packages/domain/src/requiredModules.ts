import type { AttestationKind, ControlForm } from '@ge/shared';

/** Набір модулів атестації за формою контролю. */
export function requiredModules(controlForm: ControlForm): AttestationKind[] {
  const common: AttestationKind[] = ['INTERIM', 'DIRECTOR_TEST', 'AVERAGE'];
  return controlForm === 'EXAM' ? [...common, 'EXAM'] : common;
}
