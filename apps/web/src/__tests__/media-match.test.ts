import { describe, it, expect } from "vitest";
import {
  clipsNearDives,
  groupIntoSessions,
  dateToDayKey,
  dayKey,
  dayKeyToDate,
  deduceClockOffset,
  hasUsableTime,
  matchClipsToDive,
  type MatchableClip,
  type MatchableDive,
} from "@/lib/media-match";

function dive(time: string, bottomTime = 45, id = "dive-1"): MatchableDive {
  return { id, date: new Date(`2026-07-19T${time}:00`), bottomTime };
}

function clip(time: string, id = time): MatchableClip {
  return { id, capturedAt: new Date(`2026-07-19T${time}:00`) };
}

describe("deduceClockOffset", () => {
  // El caso medido en la SD: en julio la cámara seguía en UTC+4 con Madrid en
  // UTC+2, así que los clips de una inmersión de las 11:00 se llaman ...1300...
  it("deduce el desfase de dos horas de los ficheros de julio", () => {
    const clips = [clip("13:05"), clip("13:20"), clip("13:40")];
    expect(deduceClockOffset(clips, [dive("11:00")])).toBe(120);
  });

  it("devuelve cero cuando el reloj está en hora", () => {
    expect(deduceClockOffset([clip("11:05"), clip("11:20")], [dive("11:00")])).toBe(0);
  });

  it("no se inventa un desfase con un solo clip", () => {
    expect(deduceClockOffset([clip("13:05")], [dive("11:00")])).toBeNull();
  });

  it("ignora inmersiones sin hora de entrada", () => {
    expect(deduceClockOffset([clip("13:05"), clip("13:20")], [dive("00:00")])).toBeNull();
  });

  it("prefiere el desfase menor cuando dos puntúan igual", () => {
    const clips = [clip("11:10"), clip("11:20")];
    const dives = [dive("11:00", 45, "a"), dive("09:00", 45, "b")];
    expect(deduceClockOffset(clips, dives)).toBe(0);
  });

  it("no devuelve nada sin clips", () => {
    expect(deduceClockOffset([], [dive("11:00")])).toBeNull();
  });

  // Medido sobre el logbook real: los días en los que el óptimo caía en el tope
  // del rango eran justo aquellos en los que el emparejamiento resultante era
  // falso. Sin este corte, el 24 de enero asociaba 8 clips a una inmersión que
  // había terminado tres horas antes.
  it("no devuelve un desfase que se apoya en el tope del rango", () => {
    const clips = [clip("16:00"), clip("16:10"), clip("16:20")];
    expect(deduceClockOffset(clips, [dive("11:00")])).toBeNull();
  });
});

describe("clipsNearDives", () => {
  const target = dive("11:00");

  it("descarta los clips que ningún desfase admisible podría acercar", () => {
    const clips = [clip("11:10"), clip("13:30"), clip("23:00")];
    expect(clipsNearDives(clips, [target]).map((c) => c.id)).toEqual(["11:10", "13:30"]);
  });

  it("no devuelve nada si ninguna inmersión tiene hora", () => {
    expect(clipsNearDives([clip("11:10")], [dive("00:00")])).toHaveLength(0);
  });
});

describe("matchClipsToDive", () => {
  const target = dive("11:00");

  it("casa los clips dentro de la ventana corregida por el desfase", () => {
    const clips = [clip("13:05"), clip("18:00")];
    const matched = matchClipsToDive(target, clips, 120, new Map());
    expect(matched.map((c) => c.id)).toEqual(["13:05"]);
  });

  it("incluye el tiempo de fondo en la ventana", () => {
    const matched = matchClipsToDive(target, [clip("11:40")], 0, new Map());
    expect(matched).toHaveLength(1);
  });

  it("un override manual gana al automático en los dos sentidos", () => {
    const clips = [clip("11:10"), clip("20:00")];
    const overrides = new Map([
      ["11:10", false],
      ["20:00", true],
    ]);
    expect(matchClipsToDive(target, clips, 0, overrides).map((c) => c.id)).toEqual(["20:00"]);
  });

  it("una inmersión sin hora solo acepta clips añadidos a mano", () => {
    const midnight = dive("00:00");
    const clips = [clip("11:10")];
    expect(matchClipsToDive(midnight, clips, 0, new Map())).toHaveLength(0);
    expect(matchClipsToDive(midnight, clips, 0, new Map([["11:10", true]]))).toHaveLength(1);
  });
});

describe("groupIntoSessions", () => {
  it("corta donde hay un hueco y no dentro de la ráfaga", () => {
    const clips = [clip("11:00"), clip("11:05"), clip("11:12"), clip("14:00"), clip("14:03")];
    expect(groupIntoSessions(clips).map((s) => s.length)).toEqual([3, 2]);
  });

  it("ordena por hora aunque lleguen desordenados", () => {
    const clips = [clip("14:00"), clip("11:00"), clip("11:05")];
    expect(groupIntoSessions(clips).map((s) => s.map((c) => c.id))).toEqual([
      ["11:00", "11:05"],
      ["14:00"],
    ]);
  });

  it("no devuelve ninguna sesión sin clips", () => {
    expect(groupIntoSessions([])).toHaveLength(0);
  });
});

describe("helpers", () => {
  it("dayKey usa la fecha local, no UTC", () => {
    expect(dayKey(new Date(2026, 6, 19, 23, 30))).toBe("2026-07-19");
  });

  it("dayKeyToDate ancla el día a medianoche UTC", () => {
    expect(dayKeyToDate("2026-07-19").toISOString()).toBe("2026-07-19T00:00:00.000Z");
  });

  it("dateToDayKey es la inversa de dayKeyToDate", () => {
    for (const day of ["2026-01-01", "2026-07-19", "2026-12-31"]) {
      expect(dateToDayKey(dayKeyToDate(day))).toBe(day);
    }
  });

  it("hasUsableTime distingue medianoche del resto", () => {
    expect(hasUsableTime(dive("00:00"))).toBe(false);
    expect(hasUsableTime(dive("00:01"))).toBe(true);
    expect(hasUsableTime(dive("11:00"))).toBe(true);
  });
});
