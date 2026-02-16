import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type Theme = 'dark' | 'light';

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>((localStorage.getItem('theme') as Theme) || 'dark');

  watch(theme, (newTheme) => {
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, { immediate: true });

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }

  function setTheme(newTheme: Theme) {
    theme.value = newTheme;
  }

  return {
    theme,
    toggleTheme,
    setTheme,
  };
});
