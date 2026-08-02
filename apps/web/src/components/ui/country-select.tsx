"use client";

import { countryOptions } from "@tripplanner/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WebLocale } from "@/i18n";

const NONE_VALUE = "__none__";
// Sentinel interno para variantes obligatorias (sin noneLabel) — base-ui
// necesita un `value` siempre definido para que el Select se comporte como
// controlado; con `value={undefined}` el trigger abre y se cierra solo en el
// mismo click (no hay item que renderizar en esa posición). No aparece como
// opción seleccionable en la lista.
const PLACEHOLDER_VALUE = "__placeholder__";

interface Props {
  name: string;
  value: string | undefined;
  onValueChange: (code: string | undefined) => void;
  locale: WebLocale;
  noneLabel?: string;
  placeholder?: string;
}

// Select con las 249 opciones ISO 3166-1 en el idioma activo — el listbox de
// @base-ui/react hace type-ahead nativo (saltar al escribir), así que no
// hace falta un combobox con buscador aparte para una lista de este tamaño.
//
// Sin noneLabel el campo es obligatorio: no hay opción "sin país" y arranca
// sin selección (placeholder) en vez de con NONE_VALUE preseleccionado.
export function CountrySelect({ name, value, onValueChange, locale, noneLabel, placeholder }: Props) {
  const options = countryOptions(locale);
  const selected = value ?? (noneLabel ? NONE_VALUE : PLACEHOLDER_VALUE);

  return (
    <>
      <Select
        value={selected}
        onValueChange={(v) =>
          onValueChange(v === null || v === NONE_VALUE || v === PLACEHOLDER_VALUE ? undefined : v)
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue>
            {(v: string) =>
              v === NONE_VALUE ? noneLabel :
              v === PLACEHOLDER_VALUE ? placeholder :
              (options.find((o) => o.code === v)?.name ?? v)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {noneLabel && <SelectItem value={NONE_VALUE}>{noneLabel}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.code} value={o.code}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={value ?? ""} />
    </>
  );
}
