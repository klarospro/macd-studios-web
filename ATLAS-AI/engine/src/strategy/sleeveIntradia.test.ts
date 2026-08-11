import { describe, expect, it } from "vitest";
import { cargarConfig } from "../config/sleeveConfig";
import { Vela } from "../domain/bars";
import {
  atrCreciente,
  confirmaVolumen,
  detectarOrb,
  enSesion,
  IntradiaParams,
  mediaVolumenMismaHora,
  minutosPorVela,
  objetivoIntradia,
  paramsIntradiaDesdeConfig,
  rangoApertura,
  rangoHorario,
  rangoJornadaPrevia,
  senalIntradia,
} from "./sleeveIntradia";

const DIA = 86_400;
const M5 = 300; // velas de 5 minutos

const PARAMS: IntradiaParams = {
  symbol: "frxEURUSD",
  correlationGroup: "fx",
  minutosRangoApertura: 30,
  sesiones: { londres: { abre: 420, cierra: 960 }, ny: { abre: 720, cierra: 1260 } },
  sesionesActivas: ["londres"],
  volumen: { multiploMinimo: 1.5, ventanaMediaDias: 20, muestrasMinimas: 10 },
  entradas: { orb: true, rangoPrevio: false, breakoutHorario: false },
  rangoPrevio: { exigirRetest: true, retestToleranciaAtr: 0.25 },
  breakoutHorario: { ventanaHoras: 4, exigirAtrCreciente: true },
  salidas: { stopAtrMin: 0.5, stopAtrMax: 1, tpXStop: 1 },
  atrPeriodo: 14,
  exclusionEventosMin: 15,
};

/**
 * Construye `dias` jornadas de velas M5 cubriendo el día entero, con precio
 * plano y un volumen por ticks constante. Los tests luego retocan velas sueltas.
 */
function jornadas(dias: number, precio = 1.1, ticks = 100): Vela[] {
  const velas: Vela[] = [];
  for (let d = 0; d < dias; d++) {
    for (let s = 0; s < DIA; s += M5) {
      velas.push({
        epoch: d * DIA + s,
        open: precio,
        high: precio + 0.0005,
        low: precio - 0.0005,
        close: precio,
        ticks,
      });
    }
  }
  return velas;
}

/** Índice de la vela que empieza en el minuto `minuto` del día `dia`. */
function idx(dia: number, minuto: number): number {
  return dia * (DIA / M5) + (minuto * 60) / M5;
}

describe("sleeveIntradia · utilidades", () => {
  it("deduce la duración de la vela", () => {
    expect(minutosPorVela(jornadas(1))).toBe(5);
    expect(minutosPorVela([])).toBeNull();
  });

  it("reconoce si una vela cae dentro de la sesión", () => {
    expect(enSesion(8 * 3600, PARAMS.sesiones.londres)).toBe(true);
    expect(enSesion(3 * 3600, PARAMS.sesiones.londres)).toBe(false);
    expect(enSesion(17 * 3600, PARAMS.sesiones.londres)).toBe(false);
  });
});

describe("sleeveIntradia · volumen por ticks", () => {
  it("promedia solo la MISMA hora de jornadas anteriores", () => {
    const velas = jornadas(5, 1.1, 100);
    // Subimos el volumen de las 08:00 de los días previos: solo eso debe contar.
    for (let d = 0; d < 4; d++) velas[idx(d, 480)]!.ticks = 400;
    const { media, muestras } = mediaVolumenMismaHora(velas, idx(4, 480), 20);
    expect(muestras).toBe(4);
    expect(media).toBe(400);
  });

  it("no mezcla el volumen de otras horas del día", () => {
    const velas = jornadas(5, 1.1, 100);
    for (let d = 0; d < 4; d++) velas[idx(d, 180)]!.ticks = 9_999; // madrugada
    const { media } = mediaVolumenMismaHora(velas, idx(4, 480), 20);
    expect(media).toBe(100); // la media de las 08:00 sigue intacta
  });

  it("excluye las velas de la jornada en curso", () => {
    const velas = jornadas(3, 1.1, 100);
    velas[idx(2, 475)]!.ticks = 5_000; // misma jornada, otra vela
    const { muestras } = mediaVolumenMismaHora(velas, idx(2, 480), 20);
    expect(muestras).toBe(2); // solo los dos días previos
  });

  it("confirma cuando el volumen supera 1,5x la media de esa hora", () => {
    const velas = jornadas(15, 1.1, 100);
    const t = idx(14, 480);
    velas[t]!.ticks = 151;
    expect(confirmaVolumen(velas, t, PARAMS)).toBe(true);
  });

  it("NO confirma justo en el umbral ni por debajo", () => {
    const velas = jornadas(15, 1.1, 100);
    const t = idx(14, 480);
    velas[t]!.ticks = 150;
    expect(confirmaVolumen(velas, t, PARAMS)).toBe(false);
    velas[t]!.ticks = 120;
    expect(confirmaVolumen(velas, t, PARAMS)).toBe(false);
  });

  it("NO confirma sin histórico suficiente: fallo seguro", () => {
    const velas = jornadas(3, 1.1, 100); // solo 2 jornadas previas < 10 muestras
    const t = idx(2, 480);
    velas[t]!.ticks = 9_999;
    expect(confirmaVolumen(velas, t, PARAMS)).toBe(false);
  });

  it("NO confirma si la vela no trae recuento de ticks", () => {
    const velas = jornadas(15, 1.1, 100);
    const t = idx(14, 480);
    velas[t]!.ticks = undefined;
    expect(confirmaVolumen(velas, t, PARAMS)).toBe(false);
  });
});

describe("sleeveIntradia · rangos", () => {
  it("calcula el rango de apertura solo cuando la ventana ha terminado", () => {
    const velas = jornadas(2);
    const dentro = idx(1, 440); // 07:20, la ventana 07:00-07:30 sigue abierta
    expect(rangoApertura(velas, dentro, PARAMS.sesiones.londres, 30)).toBeNull();

    const despues = idx(1, 460); // 07:40
    expect(rangoApertura(velas, despues, PARAMS.sesiones.londres, 30)).not.toBeNull();
  });

  it("el rango de apertura recoge el máximo y el mínimo de esa ventana", () => {
    const velas = jornadas(2);
    velas[idx(1, 425)]!.high = 1.2;
    velas[idx(1, 425)]!.low = 1.0;
    const rango = rangoApertura(velas, idx(1, 460), PARAMS.sesiones.londres, 30);
    expect(rango).toEqual({ alto: 1.2, bajo: 1.0 });
  });

  it("el rango de la jornada previa ignora la jornada en curso", () => {
    const velas = jornadas(3);
    velas[idx(1, 600)]!.high = 1.5; // día previo
    velas[idx(2, 600)]!.high = 9.9; // día en curso: no debe contar
    const rango = rangoJornadaPrevia(velas, idx(2, 700));
    expect(rango!.alto).toBe(1.5);
  });

  it("el rango horario excluye la vela actual", () => {
    const velas = jornadas(2);
    const t = idx(1, 600);
    velas[t]!.high = 9.9;
    const rango = rangoHorario(velas, t, 4);
    expect(rango!.alto).toBeLessThan(9.9);
  });

  it("detecta el ATR creciente", () => {
    const velas = jornadas(2);
    const t = idx(1, 600);
    // Ensanchamos las últimas velas para que el ATR reciente supere al previo.
    for (let i = t - 13; i <= t; i++) {
      velas[i]!.high = 1.11;
      velas[i]!.low = 1.09;
    }
    expect(atrCreciente(velas, t, 14)).toBe(true);
  });
});

describe("sleeveIntradia · ORB", () => {
  /** Serie con volumen y ATR válidos, y una ruptura al alza del rango de apertura. */
  function conRupturaAlza(): { velas: Vela[]; t: number } {
    const velas = jornadas(15, 1.1, 100);
    const t = idx(14, 480); // 08:00, dentro de Londres y tras la ventana 07:00-07:30
    velas[t]!.ticks = 300;
    velas[t]!.close = 1.2; // por encima del alto del rango de apertura
    velas[t]!.high = 1.21;
    return { velas, t };
  }

  it("detecta la ruptura al alza del rango de apertura", () => {
    const { velas, t } = conRupturaAlza();
    const setup = detectarOrb(velas, t, PARAMS);
    expect(setup?.tipo).toBe("orb");
    expect(setup?.side).toBe("buy");
    expect(setup?.sesion).toBe("londres");
  });

  it("no detecta nada dentro del rango de apertura", () => {
    const velas = jornadas(15, 1.1, 100);
    expect(detectarOrb(velas, idx(14, 480), PARAMS)).toBeNull();
  });

  it("no detecta fuera de la ventana de sesión", () => {
    const velas = jornadas(15, 1.1, 100);
    const t = idx(14, 1200); // 20:00, Londres ya cerró
    velas[t]!.close = 1.2;
    expect(detectarOrb(velas, t, PARAMS)).toBeNull();
  });

  it("produce una señal completa etiquetada como intradia", () => {
    const { velas, t } = conRupturaAlza();
    const signal = senalIntradia(velas, t, PARAMS);
    expect(signal).not.toBeNull();
    expect(signal!.sleeve).toBe("intradia");
    expect(signal!.side).toBe("buy");
    expect(signal!.stopPrice).toBeLessThan(signal!.entryPrice);
    expect(signal!.setupId).toMatch(/^orb:frxEURUSD:/);
  });

  it("NO produce señal si el volumen no confirma, aunque el precio rompa", () => {
    const { velas, t } = conRupturaAlza();
    velas[t]!.ticks = 100; // igual a la media
    expect(senalIntradia(velas, t, PARAMS)).toBeNull();
  });

  it("NO opera dentro de la ventana de exclusión de un evento de alto impacto", () => {
    const { velas, t } = conRupturaAlza();
    expect(senalIntradia(velas, t, PARAMS, 10)).toBeNull(); // a 10 min del dato
    expect(senalIntradia(velas, t, PARAMS, -5)).toBeNull(); // 5 min después
    expect(senalIntradia(velas, t, PARAMS, 45)).not.toBeNull(); // lejos: sí opera
  });

  it("el setupId incluye el nivel roto: impide reentrar al MISMO nivel", () => {
    const { velas, t } = conRupturaAlza();
    const primera = senalIntradia(velas, t, PARAMS);
    const segunda = senalIntradia(velas, t, PARAMS);
    expect(primera!.setupId).toBe(segunda!.setupId);
  });
});

describe("sleeveIntradia · objetivo", () => {
  it("sitúa el TP a la distancia del stop multiplicada por tp_x_stop", () => {
    const signal = { entryPrice: 100, stopPrice: 98, side: "buy" } as any;
    expect(objetivoIntradia(signal, 1)).toBeCloseTo(102, 9);
    expect(objetivoIntradia(signal, 0.8)).toBeCloseTo(101.6, 9);
  });

  it("invierte el sentido en los cortos", () => {
    const signal = { entryPrice: 100, stopPrice: 102, side: "sell" } as any;
    expect(objetivoIntradia(signal, 1)).toBeCloseTo(98, 9);
  });
});

describe("sleeveIntradia · lectura del YAML", () => {
  it("lee los parámetros del atlas.yaml desplegado", () => {
    const { params, activo, limites } = paramsIntradiaDesdeConfig(
      cargarConfig().intradia as Record<string, any>,
      "frxEURUSD",
      "fx",
    );
    expect(activo).toBe(true);
    expect(params.volumen.multiploMinimo).toBe(1.5);
    expect(params.sesiones.londres.abre).toBe(420); // 07:00 UTC
    expect(params.exclusionEventosMin).toBe(15);
    expect(limites.trades_dia_max).toBe(3);
    expect(limites.trades_semana_max).toBe(10);
    expect(limites.parar_tras_perdidas_iniciales).toBe(2);
  });
});
