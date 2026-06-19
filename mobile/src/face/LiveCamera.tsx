// Platform shim — Metro resolves ./LiveCamera to LiveCamera.web.tsx (web) or
// LiveCamera.native.tsx (android/iOS); this is the TypeScript-checker fallback.
export * from './LiveCamera.web';
