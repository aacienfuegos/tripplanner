import { describe, it, expect } from "vitest";
import {
  clipsNearDives,
  groupIntoSessions,
  groupIntoTrips,
  dateToDayKey,
  dayKey,
  dayKeyToDate,
  deduceSiteOffset,
  hasUsableTime,
  matchClipsToDive,
  type MatchableClip,
  type MatchableDive,
} from "@/lib/media-match";

function dive(time: string, bottomTime = 45, id = "dive-1"): MatchableDive {
  return { id, date: new Date(`2026-07-19T${time}:00`), bottomTime };
}

// Los clips son instantes absolutos (UTC); las inmersiones, hora de pared del
// sitio. `clip()` recibe hora del sitio y le resta el huso para que los tests se
// lean en la misma escala que las inmersiones.
const SITE_OFFSET = 120;

function clip(time: string, id = time): MatchableClip {
  return { id, capturedAt: new Date(new Date(`2026-07-19T${time}:00Z`).getTime() - SITE_OFFSET * 60000) };
}

describe("deduceSiteOffset", () => {
  it("encuentra el huso en el que estaba el ordenador de buceo", () => {
    const clips = [clip("11:05"), clip("11:20"), clip("11:40")];
    expect(deduceSiteOffset(clips, [dive("11:00")])).toBe(SITE_OFFSET);
  });

  it("funciona igual con un huso lejano, como Maldivas", () => {
    const maldivas = 5 * 60;
    const clips = ["06:20", "06:35", "06:50"].map((time, i) => ({
      id: `c${i}`,
      capturedAt: new Date(new Date(`2026-07-19T${time}:00Z`).getTime() - maldivas * 60000),
    }));
    expect(deduceSiteOffset(clips, [dive("06:13", 48)])).toBe(maldivas);
  });

  it("no se inventa un huso con un solo clip", () => {
    expect(deduceSiteOffset([clip("11:05")], [dive("11:00")])).toBeNull();
  });

  it("ignora inmersiones sin hora de entrada", () => {
    expect(deduceSiteOffset([clip("11:05"), clip("11:20")], [dive("00:00")])).toBeNull();
  });

  // El caso que descuadró el logbook real: material de superficie grabado antes
  // de entrar al agua. Descuadrar el huso se los tragaría, pero rompe las otras
  // inmersiones del día, que es lo que impide que gane.
  it("no descuadra el huso para tragarse material de superficie", () => {
    const dives = [dive("07:15", 56, "a"), dive("11:15", 54, "b"), dive("15:40", 44, "c")];
    const clips = [
      clip("07:19"), clip("07:32"), clip("07:50"), clip("08:03"),
      clip("10:29"), clip("10:41"), clip("10:45"),
      clip("11:20"), clip("11:35"), clip("11:50"),
      clip("15:55"), clip("16:10"),
    ];
    expect(deduceSiteOffset(clips, dives)).toBe(SITE_OFFSET);
  });

  it("no devuelve nada sin clips", () => {
    expect(deduceSiteOffset([], [dive("11:00")])).toBeNull();
  });
});

describe("clipsNearDives", () => {
  const target = dive("11:00");

  it("descarta los clips que ningún huso podría acercar", () => {
    const lejano = { id: "lejano", capturedAt: new Date("2026-07-21T11:00:00Z") };
    const cerca = clip("11:10");
    expect(clipsNearDives([cerca, lejano], [target]).map((c) => c.id)).toEqual(["11:10"]);
  });

  it("no devuelve nada si ninguna inmersión tiene hora", () => {
    expect(clipsNearDives([clip("11:10")], [dive("00:00")])).toHaveLength(0);
  });
});

describe("matchClipsToDive", () => {
  const target = dive("11:00");

  it("casa los clips que caen en la ventana una vez aplicado el huso", () => {
    const clips = [clip("11:10"), clip("18:00")];
    expect(matchClipsToDive(target, clips, SITE_OFFSET, new Map()).map((c) => c.id)).toEqual(["11:10"]);
  });

  it("con el huso equivocado no casa nada", () => {
    expect(matchClipsToDive(target, [clip("11:10")], 0, new Map())).toHaveLength(0);
  });

  it("incluye el tiempo de fondo en la ventana", () => {
    expect(matchClipsToDive(target, [clip("11:40")], SITE_OFFSET, new Map())).toHaveLength(1);
  });

  it("un override manual gana al automático en los dos sentidos", () => {
    const clips = [clip("11:10"), clip("20:00")];
    const overrides = new Map([
      ["11:10", false],
      ["20:00", true],
    ]);
    expect(matchClipsToDive(target, clips, SITE_OFFSET, overrides).map((c) => c.id)).toEqual(["20:00"]);
  });

  it("una inmersión sin hora solo acepta clips añadidos a mano", () => {
    const midnight = dive("00:00");
    const clips = [clip("11:10")];
    expect(matchClipsToDive(midnight, clips, SITE_OFFSET, new Map())).toHaveLength(0);
    expect(matchClipsToDive(midnight, clips, SITE_OFFSET, new Map([["11:10", true]]))).toHaveLength(1);
  });
});

describe("groupIntoTrips", () => {
  it("mantiene juntos los días de un mismo viaje", () => {
    const days = ["2026-01-25", "2026-01-26", "2026-01-27", "2026-07-19"];
    expect(groupIntoTrips(days)).toEqual([
      ["2026-01-25", "2026-01-26", "2026-01-27"],
      ["2026-07-19"],
    ]);
  });

  it("un día de descanso no parte el viaje", () => {
    expect(groupIntoTrips(["2026-01-25", "2026-01-27"])).toHaveLength(1);
  });

  it("ordena los días aunque lleguen desordenados", () => {
    expect(groupIntoTrips(["2026-01-27", "2026-01-25"])).toEqual([["2026-01-25", "2026-01-27"]]);
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
