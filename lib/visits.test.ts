import { afterEach, describe, expect, it, vi } from "vitest"
import { periodKeys, recordVisit } from "@/lib/visits"

describe("periodKeys", () => {
  it("derives UTC calendar keys with zero-padding", () => {
    const k = periodKeys(new Date("2026-06-02T10:00:00Z"))
    expect(k.day).toBe("day-2026-06-02")
    expect(k.month).toBe("month-2026-06")
    expect(k.year).toBe("year-2026")
  })

  it("uses ISO week numbering (mid-year)", () => {
    // 2026-06-22 is a Monday in ISO week 26
    const k = periodKeys(new Date("2026-06-22T00:00:00Z"))
    expect(k.week).toBe("week-2026-w26")
  })

  it("handles ISO-week year boundary (week belongs to previous year)", () => {
    // 2026-01-01 (Thursday) is in ISO week 1 of 2026
    expect(periodKeys(new Date("2026-01-01T00:00:00Z")).week).toBe(
      "week-2026-w01",
    )
    // 2021-01-01 (Friday) is in ISO week 53 of 2020
    expect(periodKeys(new Date("2021-01-01T12:00:00Z")).week).toBe(
      "week-2020-w53",
    )
  })
})

describe("recordVisit", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("increments all four period counters and maps their values", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: 10 }) }) // day
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: 20 }) }) // week
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: 30 }) }) // month
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: 40 }) }) // year
    vi.stubGlobal("fetch", fetchMock)

    const counts = await recordVisit(new Date("2026-06-22T00:00:00Z"))

    expect(counts).toEqual({ day: 10, week: 20, month: 30, year: 40 })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    // Each call hits the counter service with the period key in the URL path.
    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.endsWith("/day-2026-06-22"))).toBe(true)
    expect(urls.some((u) => u.endsWith("/week-2026-w26"))).toBe(true)
  })

  it("returns null for a period whose request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: 5 }) }) // day
      .mockResolvedValueOnce({ ok: false }) // week (non-2xx)
      .mockRejectedValueOnce(new Error("network")) // month (throws)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: 7 }) }) // year
    vi.stubGlobal("fetch", fetchMock)

    const counts = await recordVisit(new Date("2026-06-22T00:00:00Z"))

    expect(counts).toEqual({ day: 5, week: null, month: null, year: 7 })
  })
})
