import { describe, expect, it } from "vitest"
import { DEFAULT_CACHE_CONFIG, MAX_TTL_S, sanitizeCacheConfig } from "../cache-config"

describe("sanitizeCacheConfig", () => {
  it("accepts a sane config and rounds to whole seconds", () => {
    expect(sanitizeCacheConfig({ playerTtlS: 1800.4, rankingsTtlS: "7200" })).toEqual({
      playerTtlS: 1800,
      rankingsTtlS: 7200,
    })
  })

  it("accepts zero (= always fresh) and the maximum", () => {
    expect(sanitizeCacheConfig({ playerTtlS: 0, rankingsTtlS: MAX_TTL_S })).toEqual({
      playerTtlS: 0,
      rankingsTtlS: MAX_TTL_S,
    })
  })

  it("rejects anything missing, negative, non-numeric, or absurdly long", () => {
    expect(sanitizeCacheConfig(null)).toBeNull()
    expect(sanitizeCacheConfig("3600")).toBeNull()
    expect(sanitizeCacheConfig({ playerTtlS: 3600 })).toBeNull()
    expect(sanitizeCacheConfig({ playerTtlS: -1, rankingsTtlS: 10 })).toBeNull()
    expect(sanitizeCacheConfig({ playerTtlS: "abc", rankingsTtlS: 10 })).toBeNull()
    expect(sanitizeCacheConfig({ playerTtlS: 10, rankingsTtlS: MAX_TTL_S + 1 })).toBeNull()
  })

  it("ships defaults that pass its own validation", () => {
    expect(sanitizeCacheConfig(DEFAULT_CACHE_CONFIG)).toEqual(DEFAULT_CACHE_CONFIG)
  })
})
