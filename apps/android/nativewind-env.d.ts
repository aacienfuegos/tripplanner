/// <reference types="nativewind/types" />

// El import con efecto secundario de global.css en app/_layout.tsx lo resuelve
// el bundler (NativeWind), no TypeScript: sin esto tsc lo da por módulo inexistente.
declare module "*.css";
