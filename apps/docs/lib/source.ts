import { defineI18n } from 'fumadocs-core/i18n';
import { loader } from 'fumadocs-core/source';
import { docs, meta } from 'fumadocs-mdx:collections/server';
import { toFumadocsSource } from 'fumadocs-mdx/runtime/server';
import { icons } from 'lucide-react';
import { createElement } from 'react';
import { defaultLocale, locales } from './i18n';

export const i18n = defineI18n({
  languages: [...locales],
  defaultLanguage: defaultLocale,
  // Default locale URLs have no /<lang> prefix; non-default locale gets /<lang>/...
  hideLocale: 'default-locale',
  // File layout: content/<lang>/docs/...
  parser: 'dir',
});

export const source = loader({
  baseUrl: '/docs',
  source: toFumadocsSource(docs, meta),
  i18n,
  icon(icon: string | undefined) {
    if (!icon) {
      return;
    }

    if (icon in icons) {
      return createElement(icons[icon as keyof typeof icons]);
    }
  },
});
