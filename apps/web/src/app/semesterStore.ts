import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SemesterState {
  /** Обраний у шапці семестр; якщо його більше немає, береться активний. */
  semesterId: string | null;
  setSemesterId: (id: string) => void;
}

export const useSemesterStore = create<SemesterState>()(
  persist(
    (set) => ({
      semesterId: null,
      setSemesterId: (id) => {
        set({ semesterId: id });
      },
    }),
    { name: 'ge-semester' },
  ),
);

/** Обраний семестр серед доступних: збережений → активний → найновіший. */
export function pickSemester<T extends { id: string; status: string }>(
  semesters: readonly T[],
  storedId: string | null,
): T | null {
  return (
    semesters.find((s) => s.id === storedId) ??
    semesters.find((s) => s.status === 'ACTIVE') ??
    semesters[0] ??
    null
  );
}
