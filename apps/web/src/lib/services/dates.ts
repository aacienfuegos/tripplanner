// Dates come in as the forms send them (local time) and Prisma takes a Date.
// undefined is "not in the edit" and null is "clear it": both go through.
export function toDate(value: string): Date;
export function toDate(value: string | undefined): Date | undefined;
export function toDate(value: string | null | undefined): Date | null | undefined;
export function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  return new Date(value);
}
