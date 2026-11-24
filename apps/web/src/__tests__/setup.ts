import "@testing-library/jest-dom";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

// jest-dom 7 aumenta jest.Matchers, que vitest 5 ya no declara, y su /vitest
// usa Assertion<T>, con un parámetro menos que la de vitest 5.
declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown>
    extends TestingLibraryMatchers<unknown, R> {}
}
