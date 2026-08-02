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
    expect(result.sites).toHaveLength(3);
  });

  it("extracts all dive log entries", () => {
    expect(result.entries).toHaveLength(4);
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

  it("resolves country via the Logbook.Country fallback when Place.CountryID is empty", () => {
    const wreckReef = result.sites.find((s) => s.name === "Wreck Reef");
    expect(wreckReef?.country).toBe("Spain");
  });

  it("classifies gas mix from the primary tank's O2/He (single-tank air dive)", () => {
    const dive1 = result.entries.find((e) => e.depthMax === "18");
    expect(dive1?.gasMix).toBe("AIR");
    expect(dive1?.o2Percentage).toBe("21");
  });

  it("classifies nitrox from O2 > 21%", () => {
    const dive2 = result.entries.find((e) => e.depthMax === "22");
    expect(dive2?.gasMix).toBe("NITROX");
    expect(dive2?.o2Percentage).toBe("32");
  });

  it("classifies trimix when He% > 0", () => {
    const dive3 = result.entries.find((e) => e.depthMax === "30");
    expect(dive3?.gasMix).toBe("TRIMIX");
    expect(dive3?.heliumPercentage).toBe("35");
  });

  it("only imports the primary tank (lowest SortOrd) and summarizes extras in notes", () => {
    const dive2 = result.entries.find((e) => e.depthMax === "22");
    expect(dive2?.pressureStart).toBe("220");
    expect(dive2?.pressureEnd).toBe("80"); // first tank's PresE, not the second tank's 90
    expect(dive2?.notes).toContain("1 botella adicional no importada");
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

  it("copies Divetype verbatim as free text (no lookup-table join)", () => {
    const dive1 = result.entries.find((e) => e.depthMax === "18");
    expect(dive1?.diveType).toBe("2,5");
  });

  it("decodes Profile+ProfileInt into depth/time samples", () => {
    const dive1 = result.entries.find((e) => e.depthMax === "18");
    expect(dive1?.profileSamples).toEqual([
      { seconds: 60, depth: 5 },
      { seconds: 120, depth: 15 },
      { seconds: 180, depth: 18 },
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
