import { describe, expect, it } from "vitest";
import { calendarDateFromDatabase, calendarDateToDatabaseDate, formatCalendarDate } from "../Utils/calendarDate";

describe("calendar dates in associate profiles", () => {
  it.each(["1996-09-03", "2008-08-31", "2000-01-01"])("preserves %s through database serialization", (value) => {
    const stored = calendarDateToDatabaseDate(value);
    expect(calendarDateFromDatabase(stored)).toBe(value);
  });

  it("preserves the date when it is loaded for editing and saved unchanged", () => {
    const current = calendarDateFromDatabase(calendarDateToDatabaseDate("1996-09-03"));
    expect(calendarDateFromDatabase(calendarDateToDatabaseDate(current))).toBe("1996-09-03");
  });

  it("formats calendar dates without depending on the local timezone", () => {
    expect(formatCalendarDate("1996-09-03", "en-GB")).toBe("3 Sept 1996");
  });

  it("normalizes Prisma's ISO representation to the profile contract", () => {
    expect(calendarDateFromDatabase(new Date("2008-08-31T00:00:00.000Z"))).toBe("2008-08-31");
    expect(formatCalendarDate("2008-08-31", "es-PE")).toBe("31 ago. 2008");
  });

  it("keeps missing dates empty and rejects invalid calendar dates", () => {
    expect(calendarDateFromDatabase(null)).toBeNull();
    expect(calendarDateToDatabaseDate(null)).toBeNull();
    expect(formatCalendarDate(null)).toBeNull();
    expect(() => calendarDateToDatabaseDate("2008-02-31")).toThrow("La fecha de nacimiento no es válida.");
  });
});
