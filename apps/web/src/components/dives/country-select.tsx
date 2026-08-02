"use client";

import { countryOptions } from "@tripplanner/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WebLocale } from "@/i18n";

const NONE_VALUE = "__none__";

interface Props {
  name: string;
  value: string | undefined;
  onValueChange: (code: string | undefined) => void;
  locale: WebLocale;
  noneLabel: string;
}

// Select con las 249 opciones ISO 3166-1 en el idioma activo — el listbox de
// @base-ui/react hace type-ahead nativo (saltar al escribir), así que no
// hace falta un combobox con buscador aparte para una lista de este tamaño.
export function CountrySelect({ name, value, onValueChange, locale, noneLabel }: Props) {
  const options = countryOptions(locale);
  const selected = value ?? NONE_VALUE;

  return (
    <>
      <Select
        value={selected}
        onValueChange={(v) => onValueChange(v === null || v === NONE_VALUE ? undefined : v)}
      >
        <SelectTrigger className="w-full">
          <SelectValue>
            {(v: string) => (v === NONE_VALUE ? noneLabel : (options.find((o) => o.code === v)?.name ?? v))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>{noneLabel}</SelectItem>
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
