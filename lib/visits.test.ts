import { describe, expect, it } from "vitest"
import { periodKeys, recordVisit } from "@/lib/visits"

describe("periodKeys", () => {
  it("derives UTC calendar keys with zero-padding", () => {
    const k = periodKeys(new Date("2026-06-02T10:00:00Z"))
    expect(k.day).toBe("visits:day:2026-06-02")
    expect(k.month).toBe("visits:month:2026-06")
    expect(k.year).toBe("visits:year:2026")
    expect(k.total).toBe("visits:total")
  })

  it("uses ISO week numbering (mid-year)", () => {
    // 2026-06-22 is a Monday in ISO week 26
    const k = periodKeys(new Date("2026-06-22T00:00:00Z"))
    expect(k.week).toBe("visits:week:2026-W26")
  })

  it("handles ISO-week year boundary (week belongs to previous year)", () => {
    // 2026-01-01 (Thursday) is in ISO week 1 of 2026
    expect(periodKeys(new Date("2026-01-01T00:00:00Z")).week).toBe(
      "visits:week:2026-W01",
    )
    // 2021-01-01 (Friday) is in ISO week 53 of 2020
    expect(periodKeys(new Date("2021-01-01T12:00:00Z")).week).toBe(
      "visits:week:2020-W53",
    )
  })
})

describe("recordVisit", () => {
  it("returns null when no Redis env is configured", async () => {
    const prev = {
      a: process.env.KV_REST_API_URL,
      b: process.env.KV_REST_API_TOKEN,
      c: process.env.UPSTASH_REDIS_REST_URL,
      d: process.env.UPSTASH_REDIS_REST_TOKEN,
    }
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    try {
      expect(await recordVisit(new Date())).toBeNull()
    } finally {
      if (prev.a) process.env.KV_REST_API_URL = prev.a
      if (prev.b) process.env.KV_REST_API_TOKEN = prev.b
      if (prev.c) process.env.UPSTASH_REDIS_REST_URL = prev.c
      if (prev.d) process.env.UPSTASH_REDIS_REST_TOKEN = prev.d
    }
  })
})
