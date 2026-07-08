# SaaS — Regulatorio (captación de fondos) y dashboards multi-tenant

Estado: investigación inicial 2026-07-07. **Bloqueante para el producto "ahorro": validación legal pendiente (ver §1).** Detalle: `01_DETALLE_REGULATORIO_CAPTACION_FONDOS.md` (regulatorio, SIN CONFIRMAR — consultar abogado) y `02_DETALLE_DASHBOARDS_MULTITENANT_SUPABASE.md` (modelo de datos dashboards).

## 1. Regulatorio — SIN CONFIRMAR, consultar abogado antes de lanzar
El modelo tiene 3 tipos de cliente: **plantilla** (compra licencia — venta de software, bajo riesgo regulatorio), **accionista** (50/50 real, riesgo compartido genuino, requiere estructura societaria correcta) y **ahorro** (depósito + retiro prometido 2-5% mensual ≈ 24-60% anual). Este último tipo coincide con el patrón que el **Banco de España** y la **CNMV** identifican públicamente como propio de "entidades no autorizadas": captar fondos reembolsables del público con rentabilidad prometida está reservado por ley a entidades de crédito autorizadas (**Art. 9 Directiva 2013/36/UE CRD IV**, confirmado; Banco de España, confirmado). Gestionar dinero de terceros con mandato (sin captarlo como depósito propio) exige autorización CNMV como Empresa de Servicios de Inversión (ESI). Agrupar capital de varios clientes en un vehículo común puede activar el régimen de Instituciones de Inversión Colectiva / AIFMD (umbrales de minimis 100M€/500M€ en la UE, régimen exacto en España sin confirmar). **Ninguno de estos tres regímenes está satisfecho hoy por el proyecto — no ofrecer el producto "ahorro" a clientes reales sin abogado.**

## 2. Dashboards multi-tenant de solo lectura
Modelo de datos propuesto: tablas agregadas por tenant (`tenant_portfolio_snapshot`, `tenant_statements`, `tenant_capital_movements`) separadas de las tablas crudas del motor (`trading_audit_log`, venues) — el cliente NUNCA lee el motor directamente, solo datos ya agregados por un job periódico. RLS 100% `SELECT` para el cliente (nunca escritura); `tenant_id`/`rol` en `app_metadata` del JWT (patrón ya decidido en `18_SECURITY`). Cada tipo de cliente ve un subconjunto distinto (plantilla: uso de licencia; accionista: reparto 50/50; ahorro: calendario de retiros e informes).

## Cuándo usarlo / cuándo NO
- Dashboards de solo lectura: SÍ, en cuanto haya el primer tenant real — diseño ya listo para construir tras aprobación.
- Producto "ahorro" con retorno prometido: NO lanzar hasta resolver §1 con un abogado — es el mayor riesgo legal/reputacional de todo el proyecto.

## Ventajas / Desventajas
- Ventajas: "plantilla" y "accionista" bien estructurado tienen bajo/medio riesgo regulatorio y encajan con infraestructura ya decidida (RLS, proyecto Supabase separado). Dashboards agregados acotan el radio de fuga de datos si algo falla.
- Desventajas: el producto "ahorro" tal como está descrito hoy en el modelo de negocio no es simplemente arriesgado, es probablemente NO viable sin licencia — puede requerir rediseñar ese producto entero (p.ej. convertirlo en participación societaria sin retorno garantizado).

## Riesgos
- Lanzar "ahorro" sin resolver el regulatorio: sanciones, nulidad de contratos, inclusión en listas públicas de entidades no autorizadas, posible responsabilidad penal (sin confirmar tipificación exacta).
- Confundir capital "asignado" en el dashboard con capital real en el venue si el job de agregación falla o se desincroniza.

## Fuentes
Ver detalle. Oficiales: EUR-Lex (Directiva 2013/36/UE), Banco de España (bde.es), CNMV (cnmv.es), Supabase Docs (RLS).

## Sin confirmar
Ver lista completa en cada detalle. Los puntos más críticos: viabilidad legal del producto "ahorro" bajo cualquier estructura sin licencia bancaria/CNMV; umbral de minimis AIFMD aplicable en España en la práctica.
