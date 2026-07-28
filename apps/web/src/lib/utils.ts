import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Defense in depth for records saved before schema validation blocked
// javascript:/data: URIs (see confirmationUrl/fileUrl XSS fix).
export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}
