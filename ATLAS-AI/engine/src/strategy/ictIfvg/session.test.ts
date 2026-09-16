import { describe, expect, it } from "vitest";
import { SESSION_END_MINUTES, SESSION_START_MINUTES, isInFirstIfvgWindow, isWeekday, toNyTime } from "./session";

// Enero (fuera de horario de verano en EE.UU., EST = UTC-5) para evitar ambigüedad de DST.
const nyToUtcEpochEst = (year: number, month: number, day: number, nyHour: number, nyMinute: number): number =>
  Date.UTC(year, month, day, nyHour + 5, nyMinute, 0) / 1000;

/** Busca en enero de 2026 el primer día cuyo `getUTCDay()` coincida con `targetUtcDay`
 *  (0=domingo..6=sábado), sin asumir de memoria qué día de la semana cae el 1 de enero. */
function findWeekdayInJanuary2026(targetUtcDay: number): number {
  for (let day = 1; day <= 28; day++) {
    if (new Date(Date.UTC(2026, 0, day, 14, 30, 0)).getUTCDay() === targetUtcDay) return day;
  }
  throw new Error("no se encontró ese día de la semana en enero de 2026");
}

describe("toNyTime / isWeekday", () => {
  it("convierte un epoch UTC a hora local de Nueva York", () => {
    const epoch = nyToUtcEpochEst(2026, 0, 14, 9, 30);
    const t = toNyTime(epoch);
    expect(t.hour).toBe(9);
    expect(t.minute).toBe(30);
  });

  it("identifica un sábado como NO día hábil", () => {
    const day = findWeekdayInJanuary2026(6);
    expect(isWeekday(nyToUtcEpochEst(2026, 0, day, 9, 30))).toBe(false);
  });

  it("identifica un domingo como NO día hábil", () => {
    const day = findWeekdayInJanuary2026(0);
    expect(isWeekday(nyToUtcEpochEst(2026, 0, day, 9, 30))).toBe(false);
  });

  it("identifica un día entre semana como hábil", () => {
    const day = findWeekdayInJanuary2026(3); // miércoles
    expect(isWeekday(nyToUtcEpochEst(2026, 0, day, 9, 30))).toBe(true);
  });
});

describe("isInFirstIfvgWindow", () => {
  it("los bordes 9:30 y 10:10 están DENTRO de la ventana (ambos inclusive)", () => {
    expect(isInFirstIfvgWindow(nyToUtcEpochEst(2026, 0, 14, 9, 30))).toBe(true);
    expect(isInFirstIfvgWindow(nyToUtcEpochEst(2026, 0, 14, 10, 10))).toBe(true);
  });

  it("ventana fuera de horario: un minuto antes de abrir y un minuto después de cerrar", () => {
    expect(isInFirstIfvgWindow(nyToUtcEpochEst(2026, 0, 14, 9, 29))).toBe(false);
    expect(isInFirstIfvgWindow(nyToUtcEpochEst(2026, 0, 14, 10, 11))).toBe(false);
  });

  it("ventana fuera de horario: sesión de tarde, muy lejos de la ventana", () => {
    expect(isInFirstIfvgWindow(nyToUtcEpochEst(2026, 0, 14, 15, 0))).toBe(false);
  });

  it("las constantes exportadas coinciden con 9:30-10:10 en minutos", () => {
    expect(SESSION_START_MINUTES).toBe(9 * 60 + 30);
    expect(SESSION_END_MINUTES).toBe(10 * 60 + 10);
  });
});
