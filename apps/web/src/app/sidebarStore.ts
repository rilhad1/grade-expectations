import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  /** null — автоматично (згорнута на середніх екранах, розгорнута на широких). */
  collapsed: boolean | null;
  setCollapsed: (value: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: null,
      setCollapsed: (value) => {
        set({ collapsed: value });
      },
    }),
    { name: 'ge-sidebar' },
  ),
);
