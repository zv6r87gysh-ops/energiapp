import { describe, it, expect } from "vitest";
import { classifyPrice, priceBands } from "../lib/prices/chart";
describe("Prisfärger relativt det valda dygnets prisspann", () => {
  it("delar prisspannet i tre lika delar", () => {
    const bands = priceBands([10, 100]);
    expect(bands).toEqual({ low: 40, high: 70, equal: false });
    expect(classifyPrice(10, bands)).toBe("low");
    expect(classifyPrice(40, bands)).toBe("low");
    expect(classifyPrice(41, bands)).toBe("middle");
    expect(classifyPrice(70, bands)).toBe("middle");
    expect(classifyPrice(71, bands)).toBe("high");
  });
  it("hanterar negativa priser utan absoluta prisantaganden", () => {
    const bands = priceBands([-90, -30]);
    expect(classifyPrice(-90, bands)).toBe("low");
    expect(classifyPrice(-60, bands)).toBe("middle");
    expect(classifyPrice(-30, bands)).toBe("high");
  });
  it("visar lika priser neutralt även när priset är noll", () => {
    expect(classifyPrice(0, priceBands([0, 0]))).toBe("middle");
    expect(classifyPrice(100, priceBands([100, 100]))).toBe("middle");
  });
  it("klarar ett saknat dygn", () => {
    expect(priceBands([])).toBeNull();
    expect(classifyPrice(10, null)).toBe("middle");
  });
});
