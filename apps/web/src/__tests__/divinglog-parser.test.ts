import { describe, it, expect, afterAll } from "vitest";
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { parseDivingLogDatabase, DivingLogFileError } from "@/lib/divinglog-parser";
import { buildDivingLogFixture } from "./helpers/divinglog-fixture";

const fixturePath = buildDivingLogFixture();

afterAll(() => {
  rmSync(path.dirname(fixturePath), { recursive: true, force: true });
});

describe("parseDivingLogDatabase", () => {
  const result = parseDivingLogDatabase(fixturePath);

  it("extracts all dive sites, including one not referenced by any dive", () => {
    expect(result.sites).toHaveLength(4);
  });

  it("extracts all dive log entries", () => {
    expect(result.entries).toHaveLength(5);
  });

  it("extracts certifications", () => {
    expect(result.certifications).toHaveLength(1);
    expect(result.certifications[0]).toMatchObject({
      agency: "PADI",
      level: "Advanced Open Water",
      certNumber: "AOW-0001",
      instructorName: "Jane Instructor",
    });
  });

  it("resolves country via the Logbook.Country fallback when Place.CountryID is empty, normalized to Spanish", () => {
    const wreckReef = result.sites.find((s) => s.name === "Wreck Reef");
    expect(wreckReef?.country).toBe("España");
  });

  it("resolves region via the Logbook.CityID -> City join, first non-empty value wins", () => {
    const wreckReef = result.sites.find((s) => s.name === "Wreck Reef");
    expect(wreckReef?.region).toBe("Cartagena");
  });

  it("splits the '{Site} - {Area}' naming convention into name/region, preferring it over the City join", () => {
    const piles1 = result.sites.find((s) => s.name === "Piles 1");
    expect(piles1).toBeDefined();
    expect(piles1?.region).toBe("Cabo de Palos");
  });

  it("maps Place.MaxDepth when present, undefined otherwise", () => {
    const wreckReef = result.sites.find((s) => s.name === "Wreck Reef");
    const blueCave = result.sites.find((s) => s.name === "Blue Cave");
    expect(wreckReef?.maxDepth).toBe(18);
    expect(blueCave?.maxDepth).toBeNull();
  });

  it("maps Place.Water 1/2 to waterType SALT/FRESH, treating 0 as unset (not Salt)", () => {
    const wreckReef = result.sites.find((s) => s.name === "Wreck Reef");
    const blueCave = result.sites.find((s) => s.name === "Blue Cave");
    const piles1 = result.sites.find((s) => s.name === "Piles 1");
    expect(wreckReef?.waterType).toBe("SALT");
    expect(blueCave?.waterType).toBe("FRESH");
    expect(piles1?.waterType).toBeUndefined();
  });

  it("classifies gas mix from Logbook's own O2/He (single-tank air dive, Tank agrees)", () => {
    const dive1 = result.entries.find((e) => e.depthMax === "18");
    expect(dive1?.gasMix).toBe("AIR");
    expect(dive1?.o2Percentage).toBe("21");
  });

  it("classifies nitrox from O2 > 21%, falling back to the primary tank when Logbook's O2 is null", () => {
    const dive2 = result.entries.find((e) => e.depthMax === "22");
    expect(dive2?.gasMix).toBe("NITROX");
    expect(dive2?.o2Percentage).toBe("32");
  });

  it("classifies trimix when He% > 0", () => {
    const dive3 = result.entries.find((e) => e.depthMax === "30");
    expect(dive3?.gasMix).toBe("TRIMIX");
    expect(dive3?.heliumPercentage).toBe("35");
  });

  it("falls back to the primary tank (lowest SortOrd) for pressure and summarizes extras in notes when DblTank=1", () => {
    const dive2 = result.entries.find((e) => e.depthMax === "22");
    expect(dive2?.pressureStart).toBe("220");
    expect(dive2?.pressureEnd).toBe("80"); // first tank's PresE, not the second tank's 90
    expect(dive2?.notes).toContain("1 botella adicional no importada");
  });

  it("prefers Logbook's O2/He/pressure over Tank's placeholder rows and skips the extra-bottle note when DblTank=0", () => {
    const dive5 = result.entries.find((e) => e.depthMax === "20");
    expect(dive5?.gasMix).toBe("NITROX");
    expect(dive5?.o2Percentage).toBe("31"); // Logbook.O2=31, not Tank's placeholder O2=19
    expect(dive5?.pressureStart).toBe("200"); // Logbook.PresS, Tank.PresS is null
    expect(dive5?.pressureEnd).toBe("50"); // Logbook.PresE, Tank.PresE is null
    expect(dive5?.notes ?? "").not.toContain("botella adicional");
  });

  it("maps MinPPO2/MaxPPO2/CNS/VisHor when present (empty in every real export seen so far)", () => {
    const dive1 = result.entries.find((e) => e.depthMax === "18");
    expect(dive1?.minPpo2).toBe("1.2");
    expect(dive1?.maxPpo2).toBe("1.4");
    expect(dive1?.cnsPercent).toBe("8");
    expect(dive1?.visibilityHorizontal).toBe("12");

    const dive2 = result.entries.find((e) => e.depthMax === "22");
    expect(dive2?.minPpo2).toBeUndefined();
    expect(dive2?.maxPpo2).toBeUndefined();
    expect(dive2?.cnsPercent).toBeUndefined();
    expect(dive2?.visibilityHorizontal).toBeUndefined();
  });

  it("converts Surfint HH:MM text to minutes", () => {
    const dive1 = result.entries.find((e) => e.depthMax === "18");
    expect(dive1?.surfaceInterval).toBe("60");
  });

  it("keeps Divedate and Entrytime as separate date/time fields", () => {
    const dive1 = result.entries.find((e) => e.depthMax === "18");
    expect(dive1?.date).toBe("2024-06-01");
    expect(dive1?.time).toBe("10:00");
  });

  it("treats PlaceID 0 as no site (not an orphaned reference)", () => {
    const dive4 = result.entries.find((e) => e.depthMax === "12");
    expect(dive4?.diveSiteExternalId).toBeNull();
  });

  it("defaults missing bottom time to 0 minutes instead of dropping the dive", () => {
    const dive4 = result.entries.find((e) => e.depthMax === "12");
    expect(dive4?.bottomTime).toBe("0");
  });

  it("treats Rating 0 as unrated (undefined), not a literal rating of 0", () => {
    const dive2 = result.entries.find((e) => e.depthMax === "22");
    expect(dive2?.rating).toBeUndefined();
  });

  it("joins Divetype's comma-separated IDs against the Divetype table instead of showing raw digit codes", () => {
    const dive1 = result.entries.find((e) => e.depthMax === "18");
    expect(dive1?.diveType).toBe("Education, Deep");
  });

  it("maps Logbook.Entry 1/2 to entryType SHORE/BOAT, leaving other Entry values unmapped", () => {
    const dive1 = result.entries.find((e) => e.depthMax === "18");
    const dive2 = result.entries.find((e) => e.depthMax === "22");
    const dive4 = result.entries.find((e) => e.depthMax === "12");
    expect(dive1?.entryType).toBe("SHORE");
    expect(dive2?.entryType).toBe("BOAT");
    expect(dive4?.entryType).toBeUndefined();
  });

  it("extracts trips and links dives to their trip via tripExternalId", () => {
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0]).toMatchObject({
      name: "Test Trip 2024",
      startDate: "2024-06-01",
      endDate: "2024-06-03",
    });

    const dive1 = result.entries.find((e) => e.depthMax === "18");
    const dive4 = result.entries.find((e) => e.depthMax === "12");
    expect(dive1?.tripExternalId).toBe(result.trips[0].externalId);
    expect(dive4?.tripExternalId).toBeNull();
  });

  it("decodes Profile+ProfileInt into depth/time samples", () => {
    const dive1 = result.entries.find((e) => e.depthMax === "18");
    expect(dive1?.profileSamples).toEqual([
      { seconds: 60, depth: 5, temp: 28.2, ndlMinutes: 45 },
      { seconds: 120, depth: 15, temp: 26, ndlMinutes: 30 },
      { seconds: 180, depth: 18, temp: null, ndlMinutes: null },
    ]);
  });

  it("returns no samples when Profile or ProfileInt is missing", () => {
    const dive2 = result.entries.find((e) => e.depthMax === "22");
    expect(dive2?.profileSamples).toEqual([]);
  });

  it("carries Divemaster and Boat as free text", () => {
    const dive1 = result.entries.find((e) => e.depthMax === "18");
    expect(dive1?.divemaster).toBe("Jane Master");
    expect(dive1?.boat).toBe("MV Explorer");
  });

  it("maps Deco=1 to decoRequired, Deco=0/null to undefined", () => {
    const dive1 = result.entries.find((e) => e.depthMax === "18");
    const dive3 = result.entries.find((e) => e.depthMax === "30");
    expect(dive1?.decoRequired).toBeUndefined();
    expect(dive3?.decoRequired).toBe("1");
  });

  it("carries externalId from each source table's UUID", () => {
    expect(result.sites.every((s) => s.externalId.length > 0)).toBe(true);
    expect(result.entries.every((e) => e.externalId.length > 0)).toBe(true);
    expect(result.certifications.every((c) => c.externalId.length > 0)).toBe(true);
  });
});

describe("parseDivingLogDatabase — hostile input", () => {
  it("throws a clear DivingLogFileError for a file that isn't a SQLite database", () => {
    const dir = path.dirname(fixturePath);
    const notASqliteFile = path.join(dir, "not-a-db.sqlite");
    writeFileSync(notASqliteFile, "definitely not a sqlite file");

    expect(() => parseDivingLogDatabase(notASqliteFile)).toThrow(DivingLogFileError);
  });

  it("throws a clear DivingLogFileError when an expected table is missing", () => {
    const dir = path.dirname(fixturePath);
    const wrongSchemaFile = path.join(dir, "wrong-schema.sqlite");
    const db = new Database(wrongSchemaFile);
    db.exec("CREATE TABLE SomeOtherApp (id INTEGER PRIMARY KEY);");
    db.close();

    expect(() => parseDivingLogDatabase(wrongSchemaFile)).toThrow(DivingLogFileError);
  });
});
