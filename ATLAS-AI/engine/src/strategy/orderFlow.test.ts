import { describe, expect, it } from "vitest";
import {
  clv, deltaAcumuladoProxy, deltaProxy, detectarBarrido, detectarRegimen,
  esfuerzoVsResultado, PESOS_INICIALES, puntuarSetup, rangoRelativo,
  VelaFlujo, volumenRelativo, vwap,
} from "./orderFlow";

const v = (open: number, high: number, low: number, close: number, volumen: number | null = 1000, epoch = 0): VelaFlujo =>
  ({ epoch, open, high, low, close, volumen });

/** Serie plana: base neutra sobre la que inyectar el caso a probar. */
const serie = (n: number, precio = 100, volumen = 1000): VelaFlujo[] =>
  Array.from({ length: n }, (_, i) => v(precio, precio + 1, precio - 1, precio, volumen, i * 900));

describe("clv", () => {
  it("+1 cuando cierra en máximos", () => expect(clv(v(10, 12, 10, 12))).toBe(1));
  it("−1 cuando cierra en mínimos", () => expect(clv(v(10, 12, 10, 10))).toBe(-1));
  it("0 cuando cierra en el centro", () => expect(clv(v(10, 12, 10, 11))).toBe(0));
  it("0 en vela sin rango, sin dividir por cero", () => expect(clv(v(10, 10, 10, 10))).toBe(0));
});

describe("deltaProxy", () => {
  it("firma el volumen con la posición del cierre", () => {
    expect(deltaProxy(v(10, 12, 10, 12, 500))).toBe(500);
    expect(deltaProxy(v(10, 12, 10, 10, 500))).toBe(-500);
  });
  it("sin volumen no hay delta", () => expect(deltaProxy(v(10, 12, 10, 12, null))).toBe(0));
});

describe("deltaAcumuladoProxy", () => {
  it("suma la ventana y no mira más atrás de lo pedido", () => {
    const velas = [v(10, 12, 10, 12, 100), v(10, 12, 10, 12, 100), v(10, 12, 10, 10, 100)];
    expect(deltaAcumuladoProxy(velas, 2, 2)).toBe(0); // +100 -100
    expect(deltaAcumuladoProxy(velas, 2, 3)).toBe(100); // +100 +100 -100
  });
});

describe("vwap", () => {
  it("pondera por volumen, no por número de velas", () => {
    const velas = [v(10, 10, 10, 10, 1), v(20, 20, 20, 20, 99)];
    const r = vwap(velas, 1, 2)!;
    expect(r).toBeGreaterThan(19); // domina la vela de volumen 99
  });
  it("null si no hay volumen en toda la ventana", () => {
    expect(vwap([v(10, 10, 10, 10, null)], 0, 1)).toBeNull();
  });
});

describe("volumenRelativo", () => {
  it("2 cuando la vela dobla su media", () => {
    const velas = [...serie(20, 100, 1000), v(100, 101, 99, 100, 2000, 21)];
    expect(volumenRelativo(velas, 20, 20)).toBeCloseTo(2, 6);
  });
  it("null sin histórico suficiente", () => {
    expect(volumenRelativo(serie(3), 2, 20)).toBeNull();
  });
});

describe("esfuerzoVsResultado", () => {
  it("alto cuando hay mucho volumen y poco recorrido: eso es absorción", () => {
    const velas = [...serie(20, 100, 1000), v(100, 100.2, 99.8, 100, 4000, 21)];
    const e = esfuerzoVsResultado(velas, 20, 20)!;
    expect(e).toBeGreaterThan(3); // 4x volumen sobre 0,2x de rango
  });
  it("bajo cuando el volumen se traduce en movimiento", () => {
    const velas = [...serie(20, 100, 1000), v(100, 108, 92, 108, 4000, 21)];
    expect(esfuerzoVsResultado(velas, 20, 20)!).toBeLessThan(1);
  });
});

describe("detectarBarrido", () => {
  const base = () => {
    const velas = serie(25, 100, 1000);
    // Un mínimo claro en la vela 10.
    velas[10] = v(100, 101, 95, 100, 1000, 10 * 900);
    return velas;
  };

  it("detecta el barrido alcista: perfora el mínimo y recupera", () => {
    const velas = base();
    velas.push(v(97, 98, 94, 97.5, 2000, 25 * 900)); // pierde 95 y cierra encima
    const b = detectarBarrido(velas, 25, { lookback: 20 });
    expect(b?.tipo).toBe("alcista");
    expect(b?.nivel).toBe(95);
  });

  it("NO detecta barrido si se pierde el nivel y NO se recupera", () => {
    const velas = base();
    velas.push(v(97, 98, 94, 94.2, 2000, 25 * 900)); // cierra por debajo: es ruptura
    expect(detectarBarrido(velas, 25, { lookback: 20 })).toBeNull();
  });

  it("NO detecta barrido sin volumen: un barrido sin volumen es ruido", () => {
    const velas = base();
    velas.push(v(97, 98, 94, 97.5, 900, 25 * 900)); // volumen por debajo de la media
    expect(detectarBarrido(velas, 25, { lookback: 20, volumenMinimo: 1.3 })).toBeNull();
  });

  it("detecta el barrido bajista sobre el máximo", () => {
    const velas = serie(25, 100, 1000);
    velas[10] = v(100, 106, 99, 100, 1000, 10 * 900);
    velas.push(v(104, 108, 103, 105, 2000, 25 * 900));
    const b = detectarBarrido(velas, 25, { lookback: 20 });
    expect(b?.tipo).toBe("bajista");
    expect(b?.nivel).toBe(106);
  });

  it("no mira hacia delante: solo usa velas anteriores a t", () => {
    const velas = base(); // mínimo real de 95 en la vela 10
    velas.push(v(97, 98, 94, 97.5, 2000, 25 * 900)); // barrido válido en t=25
    // Vela POSTERIOR con un extremo mucho más bajo. Si el detector la mirara,
    // el nivel dejaría de ser 95 y la señal cambiaría por información futura.
    velas.push(v(100, 130, 60, 100, 5000, 26 * 900));
    const b = detectarBarrido(velas, 25, { lookback: 20 });
    expect(b?.nivel).toBe(95);
  });
});

describe("detectarRegimen", () => {
  it("clasifica alta volatilidad por expansión de rango", () => {
    const velas = [...serie(30, 100, 1000), v(100, 120, 80, 110, 1000, 31)];
    expect(detectarRegimen(velas, 30)).toBe("alta_volatilidad");
  });
  it("una serie plana es rango", () => {
    expect(detectarRegimen(serie(60), 59)).toBe("rango");
  });
  it("detecta tendencia alcista sostenida", () => {
    const velas = Array.from({ length: 80 }, (_, i) => v(100 + i, 101 + i, 99 + i, 100 + i, 1000, i * 900));
    expect(detectarRegimen(velas, 79)).toBe("tendencia_alcista");
  });
});

describe("puntuarSetup", () => {
  const conBarrido = () => {
    const velas = serie(40, 100, 1000);
    velas[20] = v(100, 101, 95, 100, 1000, 20 * 900);
    velas.push(v(97, 98, 94, 97.5, 3000, 40 * 900));
    return velas;
  };

  it("sin barrido no hay puntuación: la confluencia no se inventa una base", () => {
    expect(puntuarSetup(serie(40), 39)).toBeNull();
  });

  it("puntúa un barrido con volumen y devuelve el desglose", () => {
    const p = puntuarSetup(conBarrido(), 40)!;
    expect(p.side).toBe("buy");
    expect(p.total).toBeGreaterThan(PESOS_INICIALES.barrido); // el barrido más algo
    expect(Object.keys(p.componentes).sort()).toEqual(
      ["absorcion", "barrido", "delta", "regimen", "volumen", "vwap"],
    );
  });

  it("la puntuación nunca pasa de la suma de los pesos", () => {
    const p = puntuarSetup(conBarrido(), 40)!;
    const maximo = Object.values(PESOS_INICIALES).reduce((a, b) => a + b, 0);
    expect(p.total).toBeLessThanOrEqual(maximo);
  });

  it("cada componente respeta su peso máximo", () => {
    const p = puntuarSetup(conBarrido(), 40)!;
    for (const [k, valor] of Object.entries(p.componentes)) {
      expect(valor).toBeLessThanOrEqual(PESOS_INICIALES[k as keyof typeof PESOS_INICIALES] + 1e-9);
      expect(valor).toBeGreaterThanOrEqual(0);
    }
  });

  it("con pesos a cero la puntuación es cero: los pesos mandan de verdad", () => {
    const cero = { barrido: 0, volumen: 0, absorcion: 0, delta: 0, vwap: 0, regimen: 0 };
    expect(puntuarSetup(conBarrido(), 40, cero)!.total).toBe(0);
  });
});
