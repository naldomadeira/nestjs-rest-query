import { defineI18nUI } from 'fumadocs-ui/i18n';
import { i18n } from './source';

export const i18nUI = defineI18nUI(i18n, {
  translations: {
    en: {
      displayName: 'English',
    },
    'pt-BR': {
      displayName: 'Português',
    },
  },
});
