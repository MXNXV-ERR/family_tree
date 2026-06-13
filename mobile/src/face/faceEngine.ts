// Platform shim. Metro resolves `./faceEngine` to faceEngine.web.ts (web) or
// faceEngine.native.ts (android/iOS); this file is the fallback used by the
// TypeScript checker and any platform without a specific build.
export * from './faceEngine.web';
