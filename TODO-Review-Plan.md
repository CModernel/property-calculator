# Plan de auditoría general — TODO.md vs. código shippeado

Este documento es el plan de trabajo, no la auditoría en sí. Está ordenado de
mayor a menor importancia. Cada fase es una corrida independiente — la idea es
ejecutarlas de a una, revisar el resultado, y decidir si seguís con la
siguiente según cuánta cuota te quede.

**Aviso honesto sobre las estimaciones de cuota**: no tengo visibilidad de tus
límites reales (cuota semanal / cuota de 8hs de tu plan). Las estimaciones de
abajo son **relativas a lo que ya viste hoy** en la revisión de TODO-151/PCALC-100
(3 agentes en paralelo + una pasada de diseño + una segunda tanda de 3 agentes
de revisión) — eso es la "unidad de referencia" que uso en la tabla. Antes de
arrancar cada fase, fijate cuánta cuota te queda en el cliente y decidí en base
a eso, no en base a mi número.

## Costos actualizados (calibrados con datos reales, no estimaciones)

Los números originales de la tabla de abajo (columna "Costo relativo") eran una
unidad inventada ("~1.2x lo de hoy") sin conversión real a tu cuota. Ahora hay
un dato real: la Fase 4 corrió **1 agente en Opus (57k tokens, 22 tool calls)**
+ overhead de orquestación, y tu cuota se movió:

| | Antes | Después | Delta |
|---|---|---|---|
| Sesión (8hs) | 34% | 73% | **+39 puntos** |
| Semana (general) | 22% | 27% | **+5 puntos** |

**Ojo con el matiz importante**: Fase 4 fue la más angosta de todo Tier 2 (un
patrón puntual en un solo archivo). Fase 2/3/6/7 son auditorías completas de
módulo con 3 ángulos (revisión de código + huecos de test + afirmaciones vs.
realidad) — el mismo formato que usamos hoy temprano para revisar TODO-151, que
costó **77k-97k tokens POR AGENTE, x3 agentes, para auditar un solo TODO**. Los
módulos de Tier 2 cubren muchos TODOs a la vez (65 menciones de
`offsetSimulation` en TODO.md, 53 de ETF/strategy, 27 de upfront-cost, 22 de
Health Check), así que van a ser más grandes que Fase 4, no del mismo tamaño.

Extrapolando (linealmente, sobre un solo punto de calibración real — esto tiene
bastante incertidumbre, no lo tomes como exacto):

| Fase | Agentes est. | Tokens totales est. | **% cuota semanal est.** |
|---|---|---|---|
| Fase 2 — Health Check | 3-4 | ~350k | **~20-25%** |
| Fase 3 — Motor financiero | 3-4 | ~450k | **~25-30%** |
| Fase 6 — ETF/Strategy | 3-4 | ~380k | **~22-27%** |
| Fase 7 — Costos iniciales | 2-3 | ~220k | **~13-16%** |
| Fase 5 — Tier 1 liviano (Sonnet) | 6 | ~150k (Sonnet) | **~2-4%** (Sonnet pesa mucho menos contra la cuota que Opus) |

**Con 27% de semana disponible, no entran ni Fase 2, 3 o 6 solas** (cada una
sola ya se come casi toda tu semana), y encima necesitás guardar margen para el
resto de tu trabajo, no solo esta auditoría.

**Mi recomendación concreta**: no corras ninguna fase más de Opus (2, 3, 6, 7)
esta semana. Si querés seguir auditando sin arriesgar nada, corré la **Fase 5**
(Sonnet, ~2-4% de semana) — te da cobertura amplia de los 134 TODOs sin tocar
el presupuesto de Opus que necesitás para el resto del trabajo. Dejamos Fase 2
(la de mayor valor comprobado hoy) como la primera candidata para después del
reset del martes.

## Resumen

| # | Fase | Modelo | Plan Mode | Agentes aprox. | Costo relativo (vs. hoy) |
|---|---|---|---|---|---|
| 1 | Barridos mecánicos (Tier 0) | el que esté activo (no importa) | No | **0** (lo hago yo directo con grep/bash) | Insignificante |
| 2 | Health Check (purchaseHealthCheck/projectedHealthCheck/affordabilitySummary) | Opus | No para auditar; si aparecen fixes, sí para implementarlos | 3-4 | ~1.2x |
| 3 | Motor financiero (offsetSimulation.js) | Opus | No para auditar; Sí para fixes | 3-4 | ~1.2x |
| 4 | Patrón de cableado cruzado en App.jsx (clase de bug de TODO-144) | Opus | No para auditar; Sí para fixes | 2 | ~0.5x |
| 5 | Chequeo liviano de los 134 TODOs (Tier 1, 6 lotes) | Sonnet | No | 6 | ~0.6x (total, no por lote) |
| 6 | Motor ETF/Strategy Comparison | Opus | No para auditar; Sí para fixes | 3-4 | ~1.0x |
| 7 | Cluster de costos iniciales (states/lmi/closingCosts/totalCashRequired) | Opus | No para auditar; Sí para fixes | 2-3 | ~0.7x |

**Total si se corre todo**: ~20-23 llamados a agente, aproximadamente **5x lo
que costó hoy la revisión de TODO-151** en tokens de Opus. Es mucho — por eso
está pensado para correrse en fases separadas, no de una.

## Por qué este orden

1. **Barridos mecánicos primero** porque son prácticamente gratis (los hago yo
   mismo, sin agentes) y ya sabemos que este tipo de chequeo encuentra errores
   reales — encontré 2 hoy mismo en mi propia numeración de PCALC y en mi
   propio conteo de tests, sin necesitar ningún agente.
2. **Health Check antes que el motor financiero** porque ya tiene antecedente
   comprobado: en esta sesión encontramos 3 bugs reales ahí (TODO-146, 148/149,
   150/151), o sea que es la zona con mayor probabilidad de encontrar algo más.
3. **Motor financiero (`offsetSimulation.js`)** es el archivo más tocado de todo
   el historial (30 veces en código, 33 en tests, 65 menciones en TODO.md) — la
   base de todos los números de plata que se muestran.
4. **Patrón de cableado cruzado en App.jsx** es barato (chequeo de un patrón
   específico, no una auditoría completa del archivo) pero tiene antecedente
   directo: es exactamente la clase de bug que encontramos al revisar TODO-144
   sin plan mode.
5. **Chequeo liviano de los 134 TODOs** da cobertura amplia pero superficial —
   no busca bugs profundos, busca que lo que cada entrada dice que existe,
   siga existiendo. Cualquier cosa sospechosa que encuentre se anota para una
   futura fase profunda, no se resuelve ahí mismo.
6. **ETF/Strategy Comparison** es una función opcional (no todos los usuarios
   la activan) con menor superficie de uso que el motor principal, aunque
   tiene el mismo antecedente de bug de cableado que el punto 4.
7. **Costos iniciales** (stamp duty, LMI, closing costs) son las fórmulas más
   estáticas y antiguas del proyecto (de las primeras en tener tests, TODO-1),
   con menos cambios recientes — la de menor riesgo de las zonas financieras.

## Detalle por fase

### Fase 1 — Barridos mecánicos (Tier 0)
Sin agentes. Yo reviso directamente:
- Estructura de `TODO.md` (headers y separadores `---`)
- Numeración `PCALC-N` sin duplicados ni huecos
- Consistencia de los conteos "Suite N passing" citados en cada entrada
- Archivos sueltos `zz_*.test.*`, `.only`/`.skip` olvidados
- Barrido de texto en español en `src/`
- Referencias a identificadores en comentarios que ya no existen en el código
- Constantes tipo whitelist (`*_CATEGORIES`) chequeadas contra su propia regla documentada

### Fases 2, 3, 6, 7 — Auditoría profunda por módulo (Tier 2)
Mismo esquema de 3 ángulos que usamos en TODO-151: revisión de código de
producción, huecos de cobertura de tests, y afirmaciones de TODO.md vs.
realidad — con una pasada adversarial de verificación antes de reportar
cualquier hallazgo como confirmado. Todo en Opus por ser el trabajo que busca
bugs reales.

### Fase 4 — Patrón de cableado cruzado
Más acotado que las anteriores: un agente busca todo lugar en `App.jsx` donde
se arma más de un bundle de parámetros para el mismo cálculo (el patrón que
falló en TODO-144), y otro verifica cada hallazgo. No es una auditoría de todo
`App.jsx`, solo de ese patrón puntual.

### Fase 5 — Chequeo liviano (Tier 1)
6 lotes por posición en el archivo (~20-25 entradas cada uno), en Sonnet. Por
cada entrada: ¿el archivo/función que menciona todavía existe?, ¿el test que
dice haber agregado sigue estando y pasando?, ¿el número de tests que afirma
coincide a grandes rasgos? Sin re-derivar fórmulas ni re-verificar corrección -
solo existencia y forma. Lo que no cierre queda anotado como candidato para
una futura Fase 2/3/6/7 si esos módulos no fueron cubiertos, o como hallazgo
directo si sí lo fueron.

## Resultados

### Fase 1 — Barridos mecánicos (Tier 0) — COMPLETA

| Chequeo | Resultado |
|---|---|
| 1. Estructura de TODO.md | ✅ Limpio — 3 headers, 2 separadores en su lugar, 136 entradas (134 completadas + 2 pendientes) |
| 2. Numeración PCALC-N | ⚠️ **2 duplicados reales, 2 huecos cosméticos** (detalle abajo) |
| 3. Conteos "Suite N passing" | ✅ Secuencia siempre no decreciente (488→874), el último valor coincide con `npm test` actual |
| 4. Archivos/tests sueltos | ✅ Sin `zz_*.test.*`, sin `.only`/`.skip`/`xit`, sin `console.log` de debug en producción |
| 5. Texto en español | ✅ Limpio en todo `src/` y `config.default.json` |
| 6. Identificadores obsoletos en comentarios | ✅ Limpio — 6 candidatos encontrados, los 6 son falsos positivos justificados (uno es un fragmento de mi propio regex, cinco son nombres de campo *históricos* documentados a propósito en comentarios de migración de esquema, TODO-36/66) |
| 7. Constantes whitelist | ✅ Las 3 relevantes (`INCOME_CATEGORIES`/`RENTAL_INCOME_CATEGORIES`/`TAXABLE_INCOME_CATEGORIES`) ya cubiertas por tests hoy mismo; encontré una cuarta (`PERSONAL_EXPENSE_CATEGORIES` en App.jsx) pero no aplica el mismo patrón de riesgo — es un picklist de UI sin lógica de negocio derivada de su membresía |

**Detalle del hallazgo #2 (el único real)**: en el historial de `main` (no en
stashes, que agregaban ruido) hay dos pares de commits con el mismo número:
- **PCALC-91**: `6b16ffa` (16 ago, "Extra Investments card") y `aa9cdae` (17
  ago, "Day1/Stabilized dual-value display") — dos features distintas, mismo
  número por error.
- **PCALC-97**: `f47f4ef` (17 ago, 22:41) y `68272eb` (17 ago, 23:32) — parecen
  ser una feature y su propia extensión el mismo día, sin incrementar el
  número.
- Huecos: 24→27 (faltan 25/26) y 95→97 (falta 96) — cosmético, no ambiguo.

**Recomendación: no corregir.** A diferencia del PCALC-97/98/99 de hoy (que
renumeramos), estos están a **decenas de commits** de HEAD — renumerarlos
significa reescribir toda la historia posterior y otro force-push a `main`,
un riesgo mucho mayor que el valor de arreglar una etiqueta vieja. Quedan
documentados acá por si alguna vez hace falta ubicar esos commits por número.

**Conclusión de la Fase 1**: de 7 chequeos, 6 salieron limpios y 1 encontró un
problema real pero de severidad muy baja (cosmético, ya mitigado con esta nota).
No hay nada que amerite una entrada nueva en TODO.md.

### Fase 2 — Cluster Health Check (Tier 2) — Etapa 2A COMPLETA

**Etapa 2A: revisión de código de producción.** 1 agente Opus, sin agentes
verificadores (verificación hecha a mano, costo de agente cero). Base:
874 tests / 69 archivos verde, commit `68b4004`, árbol limpio.

**7 hallazgos reportados, 7 confirmados.** Ninguno se cayó en la verificación —
inusual, y mérito de haberle exigido al agente un escenario numérico concreto
por hallazgo y de haberle dado el mapa de archivos ya resuelto.

| # | Sitio | Defecto | Severidad |
|---|---|---|---|
| 1 | `App.jsx:865-868` | El Stress Test Stabilized re-amortiza sobre el plazo **completo** (`totalMonths`) mientras la línea base contra la que se compara usa el plazo **restante** (`projectedHealthCheck.js:160`). Rompe el invariante "survivedDelta > 0 ⟹ no está en déficit", así que `stressTestDisplay` nunca puede imprimir "Already in deficit" en ese caso. | **Alta** |
| 2 | `SimpleModeView.jsx:172` | Simple mode reimplementa el ternario del Stress Test inline y nunca recibe `alreadyInDeficitAtCurrentRate`: dice "Fails at +1%" en la misma pantalla cuyo roll-up ya dice "Monthly shortfall". TODO-148 quedó arreglado solo en Advanced. | Media-alta |
| 3 | `RiskToleranceProfiles.jsx:37` | `bufferDisplay` local guarda solo `Number.isFinite`, no `liquidSavings < 0`, y el call site (`App.jsx:2402-2404`) no le pasa `liquidSavings`. Renderiza "-0.3 months". TODO-149 arregló 2 de 3 sitios. | Media |
| 4 | `App.jsx:3506-3507`, `SimpleModeView.jsx:164` | `housingCostRatio.toFixed(0)` sin guarda de `Number.isFinite` → renderiza el literal **"Infinity%"** con 0 ingresos. Es el único figure Infinity-capable sin guarda. Clasificación 🔴 correcta, así que es solo display. | Media |
| 5 | `SimpleModeView.jsx:164,172,180` | Valor **Día-1** apareado con clasificación `worseOf(Día-1, Stabilized)` sin la anotación "stabilizes to" que Advanced sí muestra: el número y su propio texto de acción se contradicen. | Baja-media (decisión de diseño) |
| 6 | `App.jsx:3591` | El gate `rentalYieldHasData` sale de un figure de **mes 1**, así que un alquiler que arranca el mes 13 dispara el copy *"not enough data yet - add a House Rent/Room Rent income source"* para alguien que ya la agregó, y oculta una lectura Stabilized real (4,55%). El mismo gate de mes 1 (`hasRentalIncome`) además esconde la card entera de Property Summary (`App.jsx:3391`). | Media |
| 7 | `App.jsx:3605`, `App.jsx:3913` | Dos tooltips dicen `>` donde las bandas usan `>=` inclusivo: edad exactamente 70 renderiza 🔴 "Late" mientras el tooltip la llama "cutting it close"; Offset Utilisation exactamente 20,0% renderiza 🟢 "Strong" mientras el tooltip lo llama "moderate". Los otros 5 tooltips del panel usan `≥` — es deriva, no convención. | Baja |

**Sobre el #1** — el agente lo ilustró con un cambio de tasa programado al mes
200. Verifiqué la aritmética (coincide al centavo) y además calculé el umbral
real: con préstamo de $800.000 y un cambio 6%→8%, la contradicción es posible
**desde el mes 96** (año 8), y desde el mes 180 puede leer el 🟢 "Survives +3%"
completo. Un cambio de tasa a 8 años vista es un input perfectamente normal, así
que el bug es bastante más alcanzable de lo que el escenario original sugería.

**Verdictos limpios (5 de 8 ítems de la lista de caza):**
- Dirección de las 8 tablas de bandas: todas estrictamente descendentes por
  `min`. Verifiqué también el argumento del agente de que `healthCheckHasCritical`
  omitir `vacancyBufferClass` es *demostrablemente inerte* (los dos buffers
  dividen el mismo `liquidSavings` y el denominador de Emergency siempre domina,
  orden que sobrevive al `Math.min` de `worseOf`) — el argumento se sostiene.
- Base neta vs. antes de impuestos: la regla de TODO-151 está correctamente
  acotada a exactamente dos indicadores. `expenseRatio` neto es una decisión
  examinada y documentada en dos lugares, no deriva.
- Factor de vacancia aplicado exactamente una vez, campo por campo, en los dos
  caminos (Día-1 y Stabilized).
- Cobertura Day-1/Stabilized: exactamente los seis indicadores de TODO-134
  reciben `worseOf`; los tres que quedan solo en Día-1 lo están correctamente.
- Argumentos `direction` de `worseOf`: los 6 call sites correctos, chequeados
  por semántica y no por orden de declaración.
- `bindingConstraint` de `summariseAffordability`: identidad de referencia
  segura, empate determinista, casos null cubiertos, `SYMBOL_SEVERITY` completo.

El agente además **descartó dos candidatos por su cuenta** explicando por qué
(`propertyPrice <= 0` inalcanzable porque `PROPERTY_PRICE_FIELD.min = 50000`;
Offset Utilisation 100% con préstamo $0 es la respuesta correcta para el caso
"préstamo pagado"). Disciplina correcta.

**Etapas 2B (huecos de cobertura) y 2C (claims de TODO.md) siguen pendientes.**

### Fase 2 — Etapa 2B: huecos de cobertura de tests — COMPLETA

1 agente Opus, verificación a mano. Le pasé los 7 hallazgos de 2A como
calibración, más la observación que emergió de ellos: **5 de 7 eran huecos de
qué *sitio de display* está testeado, no de la matemática.** El agente confirmó
esa lectura y encontró el resto.

**Corrección a un hallazgo mío de 2A.** Dije que el contrato sin clamp de
`vacancyFactor.js` no tenía test directo. **Es falso**: está pinneado en
`offsetSimulation.test.js:1604-1624`, que afirma `vacancyFactor < 0` a 60
semanas y que el offset termina por debajo de la contribución — clampear la
función a [0,1] rompería ese test. Lo que sí sigue en pie es que es el único
módulo de `src/calculations/` sin test hermano, y que está pinneado solo a
través del motor, nunca por el camino de Health Check. El propio test documenta
la conducta como *"Not a validated design choice - flagged separately as a
candidate TODO"*, así que sigue siendo una pregunta abierta, no un contrato
validado.

**Dos errores de evidencia del agente**, que no invalidan los huecos pero hay
que dejar asentados: citó `grep "Survives"` como matcheando tres líneas de
`App.stressTestDeficit.test.jsx` — no matchea **ninguna** línea en todo el árbol,
así que ese hueco es mayor de lo que reportó; y dijo que los tres labels de
`summariseAffordability` no aparecen "en ningún test" cuando sí están pinneados
a nivel unitario (`affordabilitySummary.test.js:25,31,52`) — el hueco real es
solo de render.

**Huecos de mayor valor (verificados):**

| # | Hueco | Por qué importa |
|---|---|---|
| 1 | `SimpleModeView.test.jsx` `makeProps()` **no pasa `liquidSavings`** | `SimpleModeView.jsx:180-183` lo lee en el `valueDisplay` y en la clasificación. Es `undefined` en los 12 tests, `undefined < 0` es `false`, y **toda la rama de TODO-149 es código muerto bajo test**. Es la misma clase de deriva de props que produjo el `$NaN` — y el archivo lleva un comentario advirtiendo justamente de eso. Volvió a pasar con otro prop. |
| 2 | `Survives +N%` no se afirma en **ningún** sitio | Es la lectura que renderiza el escenario por defecto. Solo están pinneadas las dos ramas de `survivedDelta === 0`. Cambiar `stressTestSurvivedDelta` por `stabilizedStressTestSurvivedDelta` en `App.jsx:3523` (difieren por un prefijo y están a dos líneas) muestra el figure de otro escenario y la suite queda verde. |
| 3 | 5 de las 6 anotaciones "stabilizes to" sin afirmación de valor | Solo HCR está pinneada con valor (`App.grossHousingCostRatio.test.jsx:94,109`); `healthCheckStabilized.test.jsx:39` es solo existencia. Crítico para Rental Yield: `App.jsx:911` es `* 12 / 52` a mano (el comentario admite que invierte `calculateMonthlyFromWeekly` sin helper). Escribir `* 52 / 12` infla el yield ~18,8× y **`worseOf(...,'higherIsBetter')` se queda con el valor de Día-1, así que la clasificación no se mueve y nada falla.** |
| 4 | Ningún test tiene el caso Stabilized **peor** que Día-1 | Es la única dirección donde `worseOf` hace trabajo que la clasificación Día-1 no haría. Borrar `worseOf` de `App.jsx:855` — el "arreglo" obvio para el hallazgo #5 de 2A — pasa la suite entera. |
| 5 | `direction` de `worseOf` sin pinnear a nivel render en Emergency Buffer, Vacancy Buffer, Gearing y Rental Yield | Invertir el string en `App.jsx:836/889/893/913` hace que cada indicador reporte la lectura **optimista** de las dos: la única dirección de falla que un indicador de riesgo no puede tener. |
| 6 | Las 3 ramas de `stabilizedArrow` (`→ ↗ ↘`) sin ejercitar | Las flechas aparecen en un solo lugar del árbol: `HealthCheckIndicator.test.jsx:58`, **hard-codeadas como prop**. La función y los 6 literales de dirección que la alimentan están sin test. |
| 7 | Los 3 labels no-`Funded` del roll-up nunca se renderizan | Pinneados a nivel unitario, nunca por el cableado de `App.jsx:929-931`. `SimpleModeView.test.jsx` hard-codea un objeto `'Funded'` en `makeProps`, así que el test de componente tampoco puede verlo. Es la línea más grande y primera que se lee en Simple mode. |
| 8 | Mortgage-Free Age y Offset Utilisation **nunca se renderizan en ningún test** | Solo existen en `purchaseHealthCheck.test.js`. Mortgage-Free Age recibe `loanSimulation.years` — una *salida de simulación*, no `loanTermYears`: un desliz meses/años renderiza una edad como 390 en silencio. Offset Utilisation llama `calculateOffsetUtilisation` **dos veces** con los mismos argumentos (`App.jsx:3908-3910`); editar solo una da número y color derivados de cantidades distintas. |

**Hallazgo estructural.** `purchaseHealthCheck.scenarios.test.js` (TODO-147, la
red de regresión más amplia del cluster) **no importa `projectedHealthCheck.js`**
— verificado en su lista de imports. Es Día-1 puro, así que los labels que pinnea
son las clasificaciones Día-1 crudas, **no las de `worseOf(Día-1, Stabilized)`
que la UI realmente renderiza**. Un editor futuro puede satisfacer las 12 filas
de la matriz mientras la app muestra otra banda. Tampoco alcanza
`classifyVacancyBuffer`, `classifyGearing`, `classifyRentalYield`,
`calculateMortgageFreeAge` ni `calculateOffsetUtilisation`.

**Categoría descartada, verificada como sin hueco:** los límites de bandas.
Confirmé por spot-check que las 8 tablas están testeadas **exactamente en cada
umbral** (`classifyEmergencyBuffer(12/6/3)`, `classifyHousingCostRatio(50/40/30)`,
`classifyMortgageFreeAge(70)`, `classifyOffsetUtilisation(20)`, etc.). Un flip
`>=`→`>` se cazaría en las 8. No hay nada que agregar ahí.

**Cobertura genuinamente sólida** (dónde NO gastar esfuerzo): todas las tablas de
bandas; `grossIncome.js` / la reconstrucción antes-de-impuestos de TODO-151
(unitario + matriz + proyección + DOM en los 4 sitios); Housing Cost Ratio
end-to-end, el único indicador con la cadena completa; el haircut de vacancia y
sus exenciones deliberadas; `findStabilizationMonth` (8 tests); la aritmética de
`resolveProjectedFinancials` a 5 decimales.

**Existe exactamente un test cross-site** (`App.projectionAssumptions.test.jsx:408-421`,
Emergency Buffer: panel Advanced vs. `RiskToleranceProfiles`) y está bien
construido — lee el valor en vez de recalcularlo. Su límite es real y explica
por qué el defecto #3 de 2A pasó igual: su regex `/\d+\.\d+ months|∞/` no
matchea "Can't cover settlement", así que el escenario de shortfall queda fuera
de su alcance. **No hay ningún test de acuerdo Advanced-vs-Simple para ningún
indicador.**

**Etapa 2C (claims de TODO.md vs. código) sigue pendiente.**

### Fase 2 — Etapa 2C: claims de TODO.md vs. código — COMPLETA → **FASE 2 CERRADA**

1 agente Opus sobre 566 líneas de `TODO.md` (15 entradas, rangos exactos
entregados) contra el código y los tests del cluster. **14 hallazgos, 14
confirmados** por mí a mano.

**Corrección de mi propia recomendación.** Yo había propuesto saltear la 2C por
ser "el ángulo de menor rendimiento", cuyo resultado típico son correcciones de
documentación. Fue un error de juicio: la 2C encontró **dos defectos de código
que la 2A no vio**, y uno de los dos es de severidad comparable al peor hallazgo
de la 2A. La razón es estructural, no de suerte: 2A auditó cada módulo por
dentro, y estos dos defectos viven en la *consecuencia cruzada entre dos
entradas* — exactamente lo que solo se ve leyendo lo que cada entrada prometió.

**Defectos de código nuevos (no eran derivables de 2A/2B):**

| # | Sitio | Defecto | Severidad |
|---|---|---|---|
| **N1** | `App.jsx:3482-3488` + `:353` | El banner crítico (`healthCheckHasCritical`) está **anidado dentro del gate de colapso**, y TODO-140 cambió el default de `showHealthCheck` a `false`. Un indicador Tier-1 crítico **no produce ninguna señal visible en toda la página** hasta que el usuario expande el panel. Incluye `fhbConcessionLost`: un first home buyer que pierde la concesión (≈$9.797 de stamp duty en el escenario por defecto) no recibe advertencia alguna. TODO-68 había justificado poner el banner ahí y no en el hero con *"impossible to miss without expanding the card, which is open by default anyway"* — TODO-140 falsificó esa premisa sin registrarlo. | **Alta** |
| **N2** | `affordabilitySummary.js:52` | El roll-up considera **2 de los 3** indicadores que Simple mode muestra: `[emergencyBufferClass, housingCostRatioClass]`, sin Interest Rate Stress Test. Un escenario positivo hoy pero que falla a +1% (🔴 crítico) con buffer sano y HCR bueno resuelve a **"🟢 Funded — with room in the indicators below"** justo encima de su propia fila roja. Viola la premisa declarada del módulo: *"Every branch below is something the user can independently verify on the same screen."* | Media-alta |

**Afirmaciones falsas o incompletas en `TODO.md` (12 restantes), verificadas:**

| Entrada | Afirmación | Realidad |
|---|---|---|
| TODO-135 (`4846`) | *"TODO-134 annotations intact"* en Simple mode | `grep -c secondaryValueDisplay src/components/SimpleModeView.jsx` → **0**. Ninguna anotación "stabilizes to" renderiza ahí, pero las clasificaciones que hereda **sí** son las de `worseOf`. Es la afirmación opuesta al defecto #5 de 2A. |
| TODO-148 (`5049-5054`) | describe el arreglo completo, sin mencionar sitios | Llegó solo a Advanced. Su hermana TODO-149 **sí** registra su mitad de Simple mode, así que la asimetría se lee como "Simple no estaba afectado" en vez de "se pasó por alto". |
| TODO-149 (`5084-5089`) | enumera dos sitios de display | Hay un tercero: `RiskToleranceProfiles.jsx:37`. |
| TODO-147 (`5024-5028`) | *"Replicates App.jsx's own Day-1 wiring"* | Adecuado para los *valores*, inadecuado para las *etiquetas*: `:129-132` clasifica los números Día-1 crudos, y 3 de las 4 etiquetas pinneadas no son las que el panel renderiza. |
| TODO-150 (`5134-5136`) | los gates ahora son *"a data-presence question"* | Siguen siendo preguntas de mes 1 (`App.jsx:645`). El caso de 52 semanas está arreglado; el de alquiler con inicio programado, no. |
| TODO-68/69/70 (`2162-2164`) | `HealthCheckIndicator` *"used by all 10 indicators"* | 9 usos (`grep -c` → 9). El aviso de FHB es markup a mano (`App.jsx:3542-3548`), sin clasificación, tooltip ni acción. |
| TODO-68/69/70 (`2178-2183`) | input de edad donde *"0 means not provided"* con `formatValue` *"Not set"* | Revertido por TODO-88: `currentAge ?? 30`, gate separado `showMortgageFreeAge ?? false`, piso del slider 18. `grep '"Not set"'` → **0**. |
| TODO-95 (`2794`) | *"default 0 (no vacancy modeled)"* | El default real es **2**: `App.jsx:397` cae en `?? 2` y `config.default.json` no tiene la clave (grep → 0). Es la misma ausencia de clave que produjo la trampa del `NaN` en la matriz durante TODO-150. |
| TODO-95 (`2809-2811`) | *"confirming only the future simulation is affected"* | Falso desde TODO-150: `App.jsx:646` aplica el factor al Día-1, así que mueve el ingreso de alquiler mensual, `monthlyNetBalance`, HCR y Gearing. |
| TODO-134 (`4414-4417`) | Stress Test y Gearing *"only re-amortizing if a scheduled rate change applies by then"* | La frase agrupa dos indicadores que **amortizan sobre plazos distintos**. Es el lugar donde se introdujo y se glosó el defecto #1 de 2A. |
| TODO-133 (`4384`, `4388`) | dos citas de línea | Derivadas: Offset Utilisation renderiza en `App.jsx:3906-3914`, y `OFFSET_UTILISATION_BANDS` está en `purchaseHealthCheck.js:175`, no `:168` (ahí está `classifyMortgageFreeAge`). |
| TODO-147 (`5038-5041`) | nombra la propiedad *"effectiveTaxRate es inerte"* | Estrechada por TODO-151: el test ahora dice *"changes nothing OUTSIDE Housing Cost Ratio"* (`:273`) y `:277` pinnea lo contrario para HCR. Obsoleta, no oculta. |

**Prioridad 4 (aritmética de conteos): cero hallazgos.** Todos los conteos por
archivo y desgloses internos se sostienen — TODO-146 (5), TODO-147 (12 filas),
TODO-148 (3), TODO-149 (4), TODO-150 (16 = 4+4+6+2), TODO-152 (2), TODO-135
(34 = 6+10+10+8), TODO-151 (61 = 24+6+26+5). El agente además se abstuvo de un
falso positivo que estaba a mano (la lectura "2 tests en el archivo nombrado" de
TODO-146) por haber grepeado antes de afirmar.

**Entradas limpias:** TODO-67, TODO-129 (verifiqué su afirmación load-bearing:
`isInvestmentProperty` presente en los tres call sites del motor —
`App.jsx:751`, `:778`, `:2094`), TODO-146, TODO-152 (la entrada más precisa de
las quince).

**Etapa 2C sin errores de evidencia**, a diferencia de 2B. Las citas de línea
verificadas coincidieron todas.

## Fase 2 — Total

| Etapa | Hallazgos reportados | Confirmados |
|---|---|---|
| 2A — código de producción | 7 | **7** |
| 2B — huecos de cobertura | 8 | **8** |
| 2C — claims vs. código | 14 | **14** |

**9 defectos de código confirmados** (7 de 2A + 2 nuevos de 2C), **8 huecos de
test accionables**, **12 afirmaciones de `TODO.md` a corregir**. Cero cambios de
código en toda la fase.

### Fase 3 — Matriz de parámetros del motor financiero — COMPLETA (un solo ángulo)

1 agente Opus. **La matriz 21 × 6 salió LIMPIA: las 126 celdas resuelven** a
*presente* o *ausente-y-correcto*. No hay ningún bundle que herede un default
inerte que el input del usuario debiera haber sobrescrito, y el trío `effective*`
llega correcto a los cinco bundles que lo llevan (`754-756`, `781-783`,
`2235-2237`, `2301-2303`, `2372-2374`). El sexto (`gridBaseParams`) pasa
literales `1`/`0` con un comentario TODO-144 que documenta la decisión
(`App.jsx:2096-2105`) — o sea, declarado, no heredado.

Segundo veredicto limpio de la auditoría, después de la Fase 4. Verifiqué las
celdas por spot-check y se sostienen.

**Un hallazgo adyacente, fuera de la matriz — misma clase de bug de TODO-144:**

| # | Sitio | Defecto | Severidad |
|---|---|---|---|
| **N3** | `App.jsx:330-332` + `:1027`, `:1031` | El trío `effective*` se aplica bien **hacia el motor**, pero **no hacia el payload de guardado**: se guardan los valores crudos, y `etfStartTrigger` no se guarda — se **re-deriva al cargar** con una cadena de prioridad (`etfStartMonth > 1` gana, luego `etfReserveMonths > 0`, luego `switchThresholdPct > 0`). Ningún `setEtfStartTrigger` limpia sus hermanos (verificado en los 5 call sites: `1976, 1987, 2015, 2044, 2185`). | Media |

**Escenario, verificado paso a paso:** el usuario pone "delay to month = 36",
después cambia el selector a "loan ratio = 20%". En sesión está bien
(`effectiveEtfStartMonth = 1`). Guarda: el payload lleva `etfStartMonth: 36`
**y** `switchThresholdPct: 20`. Al recargar, la cadena de prioridad ve `36 > 1`,
devuelve `'month'`, y **se aplica el criterio que el usuario no eligió mientras
se descarta el que sí eligió**. El escenario recargado corre una simulación
distinta de la que se guardó, y eso mueve las cifras principales ("Loan paid off
in", "Total interest paid") y el balance ETF del Timeline Explorer.

**Lo más filoso:** el comentario en `App.jsx:336-337` afirma *"switching criteria
can never leave a stale gate applied"*. Es **cierto en sesión y falso a través de
un guardado/recarga**. Y la decisión de re-derivar en vez de guardar está
documentada en `App.jsx:1028-1030` citando a **TODO-144** — o sea, el arreglo de
TODO-144 tiene un agujero exactamente en el mecanismo que introdujo. El arreglo
es barato: guardar `etfStartTrigger` en el payload, con la cadena de prioridad
como fallback para escenarios viejos.

El agente **no cotizó un delta en dólares** y explicó por qué (qué gate dispara
primero depende del préstamo, y no tenía permitido correr la simulación).
Abstención correcta: el mecanismo es determinado, la magnitud no.

**Corrección a una premisa mía.** Mi plan afirmaba que `baselineSimulation` es la
línea base *offset-only* y que anular sus parámetros de ETF "es el punto del
bundle". **Es falso**, y el agente lo corrigió bien: un `diff` de los dos bundles
devuelve **una sola línea** de diferencia — `contributions: []` vs
`contributions: offsetContributions`. La configuración de ETF es idéntica en
ambos, porque su consumidor es
`interestSaved = baselineSimulation.totalInterest - loanSimulation.totalInterest`
(`App.jsx:786`), que aísla el valor de las contribuciones programadas al offset
manteniendo el ETF fijo en los dos brazos. Anular el ETF ahí **habría sido** el
defecto. Invertía el veredicto esperado de toda esa columna.

**Límite de esta fase, explícito:** la Fase 3 quedó cubierta en **un solo
ángulo**. Los ángulos de cobertura de tests y de claims de `TODO.md` para el
motor financiero **no se corrieron**, y la matemática interna del loop
(re-amortización de TODO-57, switch a ETF, drenaje del offset, negative gearing)
quedó deliberadamente fuera de alcance. La fase **no** está completa en el
sentido en que lo está la Fase 2.

## Cómo seguir

- La Fase 1 la puedo correr ahora mismo si querés, en este mismo turno — no
  gasta cuota de agentes.
- Para cada fase siguiente: decime cuál corremos y yo la lanzo como una corrida
  del Workflow tool aparte (no todo junto), así podés cortar la secuencia en
  cualquier punto sin perder lo ya encontrado.
- Cada fase termina en un reporte de hallazgos, no en cambios de código ni de
  `TODO.md` — lo que aparezca se prioriza y se decide aparte, igual que hicimos
  con la revisión de PCALC-100.
