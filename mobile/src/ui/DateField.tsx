// Platform shim — Metro resolves ./DateField to DateField.web.tsx (web) or
// DateField.native.tsx (android/iOS); this is the TypeScript-checker fallback.
export * from './DateField.web';
