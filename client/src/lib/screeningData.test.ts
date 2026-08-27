import { describe, expect, it } from "vitest";
import { getAdminApplications } from "@/lib/adminMockData";
import { getScreeningRecord, getScreeningRecords } from "@/lib/screeningData";

describe("screening v2 compatibility state", () => {
  it("keeps prototype applications explicitly Legacy and score-free", () => {
    const record = getScreeningRecord(getAdminApplications()[0]);
    expect(record.readiness).toBe("Legacy");
    expect(record.finalScore).toBeNull();
    expect(record.appliedBand).toBe("Legacy");
    expect(record.floorStatus).toBe("Legacy");
    expect(record.integrity).toBe("Legacy");
  });

  it("maps eligibility independently of scoring and preserves application order", () => {
    const records = getScreeningRecords("Business Development Officer");
    expect(records).toHaveLength(12);
    expect(records.find((record) => record.application.id === "app-david-johnson")?.eligibility).toBe("Closed");
    expect(records.every((record) => record.finalScore === null)).toBe(true);
    expect(records.map((record) => record.application.appliedDate)).toContain("2026-08-26");
  });
});
