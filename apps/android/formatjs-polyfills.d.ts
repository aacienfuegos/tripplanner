// Los subpaths de locale-data de @formatjs son JS puro sin .d.ts propios —
// solo se importan por su efecto secundario (registran datos de locale).
declare module "@formatjs/intl-displaynames/polyfill";
declare module "@formatjs/intl-displaynames/locale-data/*";
declare module "@formatjs/intl-locale/polyfill";
