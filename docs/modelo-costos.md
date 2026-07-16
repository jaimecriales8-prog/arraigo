# Modelo de costos y precio — Arraigo

> Actualizado: 2026-07-13 · Herramienta interactiva: `costeo.html` (raíz del repo)

Calculadora autocontenida (HTML, abre con doble clic, sin internet). Estima costo por preso/mes, precio con margen y payback a partir de supuestos editables. Complementa a las otras dos calculadoras que existieron en sesión (costo por verificación y personal/FTE).

## Estructura del costeo

### Costo por verificación (tecnología)
- **FaceTec** (liveness 3D): precio negociado, se cobra por check. NO público → requiere quote. Es el componente dominante del costo por verificación.
- **OpenAI** (escena, GPT-4o-mini): ≈ US$0.001/verificación (2 imágenes low-detail).
- **Infra fija** (Supabase, etc.): plano mensual (~US$25).
- **Operación software/BD**: COP/preso/mes (hosting BD, backups, mantenimiento) — default $10.000.
- Conclusión: sin FaceTec, la tecnología por verificación es casi gratis (<½ centavo USD).

### Personal (FTE calculados)
Fórmulas (por cada N presos, estado estable):
- **Técnicos** = onboardings/mes ÷ capacidad. onboardings/mes = (presos/duración) × 1,1 revisitas. Driver: dispersión geográfica.
- **Operadores** = max(carga de triaje de alertas, cobertura horaria × relevo fin de semana). Driver: % cumplimiento + horas de cobertura.
- **Soporte** = mesa (tickets) + plataforma (piso). **Coordinación** = piso por contrato.
- Ratio típico ~1 persona por cada ~125 presos (a 1.000). No lineal hacia abajo: soporte/coordinación tienen piso.
- Nómina = FTE × salario BASE × (1 + **factor prestacional**, aportes de ley + prestaciones, default 50%).

### Inversión inicial (CAPEX, se amortiza)
Desarrollo · Setup FaceTec · **Adecuación de sede** (obra/eléctrico/redes) · **Centro de monitoreo** · **Mobiliario** · **Equipos de campo** · Legal · Capacitación · Otro. Montaje físico de sede ≈ $150M. Se divide entre los meses de amortización → cuota mensual que entra al costo.

### Costos mensuales fijos/variables
- **Sede y servicios**: arriendo + servicios públicos + internet (fijo).
- **Vehículos y transporte**: alquiler + combustible (fijo mensual, NO compra — la compra sería CAPEX).
- **Datos/SIM/equipo**: COP/preso/mes (variable).
- **Overhead admin**: % sobre el costo mensual.

### Onboarding — costo ÚNICO por preso (separado del mensual)
- Campo `cOnb`: costo único por preso (visita técnico + enrolamiento FaceTec + setup). NO entra al mensual ni al precio mensual.
- **Interruptor "los técnicos se cubren con el onboarding"** (default ON): saca a los técnicos de la nómina mensual para evitar doble conteo (su trabajo es el onboarding, cobrado aparte). Al activarlo, el costo mensual por preso baja.

## Salida
- **Costo por preso/mes** (sin onboarding) · **Costo total/mes** · **Inversión inicial** · **Personal total** · **Onboarding único** (aparte).
- **Precio sugerido** = costo/preso ÷ (1 − margen). Facturación mensual/anual + **payback** (CAPEX ÷ utilidad mensual).
- Toggle **COP/USD** con TRM editable; campos de dinero con separador de miles.

## Notas de negocio
- El costo real por verificación ES esencialmente el precio de FaceTec → la negociación con FaceTec define el modelo. Palanca: FaceTec solo en sorpresas baja ~80-90%.
- La nómina y la amortización pesan más que la tecnología a escala.
- Costos fijos (sede, vehículos) se diluyen con volumen → el servicio es más eficiente a más presos; pilotos pequeños salen caros por preso.
- Todos los valores por defecto son placeholders — reemplazar con cotizaciones reales (FaceTec, salarios cargados con contabilidad, arriendo, etc.).
