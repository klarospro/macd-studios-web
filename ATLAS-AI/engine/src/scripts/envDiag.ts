// Diagnóstico ENMASCARADO del entorno Deriv.
// Se ejecuta con --env-file (igual que el motor). NUNCA imprime el valor del token.
function mask(v: string | undefined): string {
  if (v === undefined) return "<no definida>";
  const len = v.length;
  const lead = v.length !== v.trimStart().length ? " ⚠️espacio-al-inicio" : "";
  const trail = v.length !== v.trimEnd().length ? " ⚠️espacio-al-final" : "";
  const quotes = /^["']|["']$/.test(v) ? " ⚠️comillas" : "";
  return `presente · ${len} chars${lead}${trail}${quotes}`;
}

const derivKeys = Object.keys(process.env).filter((k) => /deriv/i.test(k));

console.log("=== Diagnóstico env (enmascarado) ===");
console.log(`DERIV_API_TOKEN: ${mask(process.env.DERIV_API_TOKEN)}`);
console.log(`DERIV_APP_ID:    ${mask(process.env.DERIV_APP_ID)}`);
console.log(`Todas las claves que contienen "deriv": [${derivKeys.map((k) => `"${k}"`).join(", ")}]`);
