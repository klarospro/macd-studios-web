import { describe, expect, it } from "vitest";
import { CICLOS_PARA_AVISAR, evaluarSalud, EstadoVigilancia, minutosCaido } from "./vigilanciaVenue";

const sano: EstadoVigilancia = { ciclosSinOfertas: 0, avisoEnviado: false };

describe("vigilanciaVenue", () => {
  it("con catálogo de símbolos el venue es operable y no avisa", () => {
    const d = evaluarSalud(13, sano);
    expect(d.operable).toBe(true);
    expect(d.accion).toBe("ninguna");
    expect(d.ciclosSinOfertas).toBe(0);
  });

  it("fin de semana: los símbolos siguen ofreciéndose aunque estén cerrados", () => {
    // El discriminante es que HAYA catálogo, no que esté abierto. Un domingo
    // active_symbols devuelve los 13 con exchange_is_open=0 y eso es normal.
    expect(evaluarSalud(13, sano).operable).toBe(true);
  });

  it("cero símbolos no avisa a la primera: puede ser un corte de red", () => {
    const d = evaluarSalud(0, sano);
    expect(d.operable).toBe(false);
    expect(d.accion).toBe("ninguna");
    expect(d.ciclosSinOfertas).toBe(1);
  });

  it("avisa al alcanzar el umbral de ciclos consecutivos", () => {
    let estado: EstadoVigilancia = sano;
    const acciones: string[] = [];
    for (let i = 0; i < CICLOS_PARA_AVISAR; i++) {
      const d = evaluarSalud(0, estado);
      acciones.push(d.accion);
      estado = { ciclosSinOfertas: d.ciclosSinOfertas, avisoEnviado: d.avisoEnviado };
    }
    expect(acciones).toEqual(["ninguna", "ninguna", "avisar_caido"]);
  });

  it("no repite el aviso mientras siga caído", () => {
    // Esto es lo que evita 204 mensajes en 17 horas.
    let estado: EstadoVigilancia = { ciclosSinOfertas: CICLOS_PARA_AVISAR, avisoEnviado: true };
    for (let i = 0; i < 50; i++) {
      const d = evaluarSalud(0, estado);
      expect(d.accion).toBe("ninguna");
      estado = { ciclosSinOfertas: d.ciclosSinOfertas, avisoEnviado: d.avisoEnviado };
    }
    expect(estado.ciclosSinOfertas).toBe(CICLOS_PARA_AVISAR + 50);
  });

  it("al recuperarse cierra el incidente y rearma la vigilancia", () => {
    const previo: EstadoVigilancia = { ciclosSinOfertas: 204, avisoEnviado: true };
    const d = evaluarSalud(13, previo);
    expect(d.accion).toBe("avisar_recuperado");
    expect(d.operable).toBe(true);
    expect(d.ciclosSinOfertas).toBe(0);
    expect(d.avisoEnviado).toBe(false);
  });

  it("si cayó sin llegar a avisar, la recuperación no manda nada", () => {
    const d = evaluarSalud(13, { ciclosSinOfertas: 2, avisoEnviado: false });
    expect(d.accion).toBe("ninguna");
  });

  it("puede volver a avisar en una caída posterior", () => {
    const recuperado = evaluarSalud(13, { ciclosSinOfertas: 10, avisoEnviado: true });
    let estado: EstadoVigilancia = { ciclosSinOfertas: recuperado.ciclosSinOfertas, avisoEnviado: recuperado.avisoEnviado };
    let ultima = "";
    for (let i = 0; i < CICLOS_PARA_AVISAR; i++) {
      const d = evaluarSalud(0, estado);
      ultima = d.accion;
      estado = { ciclosSinOfertas: d.ciclosSinOfertas, avisoEnviado: d.avisoEnviado };
    }
    expect(ultima).toBe("avisar_caido");
  });

  it("traduce ciclos a minutos para el texto del aviso", () => {
    expect(minutosCaido(3)).toBe(15);
    expect(minutosCaido(204)).toBe(1020);
  });
});
