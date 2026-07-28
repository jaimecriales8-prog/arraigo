import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Muestra mínima para que un grupo se reporte — grupos más chicos se
// descartan en silencio (no se muestran como "insuficiente") para no
// ensuciar la lista con ruido estadístico.
const MIN_CASOS = 3
const MIN_CHECKINS = 15
const TOP_N = 10

// Whitelist fija de campos cruzables — nunca se arma SQL dinámico con
// nombres de columna del cliente; todo el cruce se calcula aquí en JS
// sobre un dataset ya acotado (una fila por caso).
const CAMPOS: { key: string; label: string; formato?: (v: any) => string }[] = [
  { key: 'genero', label: 'Género' },
  { key: 'estrato', label: 'Estrato', formato: (v) => `Estrato ${v}` },
  { key: 'nivel_educativo', label: 'Nivel educativo' },
  { key: 'estado_civil', label: 'Estado civil' },
  { key: 'ocupacion', label: 'Ocupación' },
  { key: 'regimen_salud', label: 'Régimen de salud' },
  { key: 'tenencia_vivienda', label: 'Tenencia de vivienda' },
  { key: 'tiene_hijos', label: 'Tiene hijos', formato: (v) => (v ? 'Sí' : 'No') },
  { key: 'movilidad_reducida', label: 'Movilidad reducida', formato: (v) => (v ? 'Sí' : 'No') },
  { key: 'danger_level', label: 'Peligrosidad', formato: (v) => `Nivel ${v}` },
]

interface CasoStat {
  case_id: string
  total_checkins: number
  aprobados: number
  excusados: number
  [key: string]: any
}

interface Grupo {
  descripcion: string
  tasa: number
  casos: number
  checkins: number
}

interface Conteo {
  valor: string
  n: number
}

interface CampoPoblacion {
  label: string
  total: number
  conteos: Conteo[]
}

async function getDatos() {
  const cookieStore = await cookies()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('profiles').select('role, organization_id').eq('id', user.id).single()
  if (!me || !['judicial', 'super_admin'].includes(me.role)) {
    redirect('/dashboard')
  }

  const { data: statsRaw } = await supabase.rpc('demografia_cumplimiento_stats', {
    p_organization_id: me.role === 'super_admin' ? null : me.organization_id,
  })

  const todosLosCasos: CasoStat[] = (statsRaw ?? []).map((s: any) => ({
    ...s,
    total_checkins: Number(s.total_checkins ?? 0),
    aprobados: Number(s.aprobados ?? 0),
    excusados: Number(s.excusados ?? 0),
  }))

  // Caracterización poblacional: conteo simple por categoría, sobre TODOS los
  // casos de la org (sin filtrar por si tienen check-ins) — no es sobre
  // cumplimiento, es solo "cuántas mujeres, cuántos universitarios, etc.".
  const poblacion: CampoPoblacion[] = CAMPOS.map(campo => {
    const conteoMap = new Map<string, number>()
    let total = 0
    for (const s of todosLosCasos) {
      const valor = s[campo.key]
      if (valor == null) continue
      const etiqueta = campo.formato ? campo.formato(valor) : String(valor)
      conteoMap.set(etiqueta, (conteoMap.get(etiqueta) ?? 0) + 1)
      total++
    }
    const conteos = [...conteoMap.entries()]
      .map(([valor, n]) => ({ valor, n }))
      .sort((a, b) => b.n - a.n)
    return { label: campo.label, total, conteos }
  }).filter(c => c.total > 0)

  const stats: CasoStat[] = todosLosCasos
    // Solo casos con señal real de cumplimiento (al menos un check-in no excusado)
    .filter((s: CasoStat) => s.total_checkins - s.excusados > 0)

  if (stats.length === 0) {
    return { baseline: null, mejores: [] as Grupo[], peores: [] as Grupo[], totalCasos: 0, poblacion, totalPoblacion: todosLosCasos.length }
  }

  const totalDenom = stats.reduce((acc, s) => acc + (s.total_checkins - s.excusados), 0)
  const totalAprobados = stats.reduce((acc, s) => acc + s.aprobados, 0)
  const baseline = Math.round((totalAprobados / totalDenom) * 100)

  // Genera grupos de 1 y 2 variables sobre los valores realmente presentes
  const grupos = new Map<string, { casos: Set<string>; denom: number; aprobados: number; descripcion: string }>()

  function acumular(key: string, descripcion: string, s: CasoStat) {
    const g = grupos.get(key) ?? { casos: new Set<string>(), denom: 0, aprobados: 0, descripcion }
    g.casos.add(s.case_id)
    g.denom += s.total_checkins - s.excusados
    g.aprobados += s.aprobados
    grupos.set(key, g)
  }

  for (const s of stats) {
    // Combinaciones de 1 variable
    for (const campo of CAMPOS) {
      const valor = s[campo.key]
      if (valor == null) continue
      const etiqueta = campo.formato ? campo.formato(valor) : String(valor)
      const key = `${campo.key}=${valor}`
      acumular(key, `${campo.label}: ${etiqueta}`, s)
    }
    // Combinaciones de 2 variables
    for (let i = 0; i < CAMPOS.length; i++) {
      for (let j = i + 1; j < CAMPOS.length; j++) {
        const c1 = CAMPOS[i], c2 = CAMPOS[j]
        const v1 = s[c1.key], v2 = s[c2.key]
        if (v1 == null || v2 == null) continue
        const e1 = c1.formato ? c1.formato(v1) : String(v1)
        const e2 = c2.formato ? c2.formato(v2) : String(v2)
        const key = `${c1.key}=${v1}&${c2.key}=${v2}`
        acumular(key, `${c1.label}: ${e1} + ${c2.label}: ${e2}`, s)
      }
    }
  }

  const candidatos: Grupo[] = []
  for (const g of grupos.values()) {
    if (g.casos.size < MIN_CASOS || g.denom < MIN_CHECKINS) continue
    candidatos.push({
      descripcion: g.descripcion,
      tasa: Math.round((g.aprobados / g.denom) * 100),
      casos: g.casos.size,
      checkins: g.denom,
    })
  }

  const mejores = [...candidatos].sort((a, b) => b.tasa - a.tasa).slice(0, TOP_N)
  const peores = [...candidatos].sort((a, b) => a.tasa - b.tasa).slice(0, TOP_N)

  return { baseline, mejores, peores, totalCasos: stats.length, poblacion, totalPoblacion: todosLosCasos.length }
}

function TablaHallazgos({ titulo, grupos, baseline, mejor }: { titulo: string; grupos: Grupo[]; baseline: number; mejor: boolean }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>{titulo}</h2>
      </div>
      {grupos.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Sin hallazgos con muestra suficiente todavía.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {grupos.map((g, i) => {
              const delta = g.tasa - baseline
              const deltaColor = mejor
                ? (delta >= 0 ? 'var(--success)' : 'var(--text-muted)')
                : (delta <= 0 ? 'var(--danger)' : 'var(--text-muted)')
              return (
                <tr key={i} style={{ borderBottom: i < grupos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '12px 20px', fontSize: 13.5 }}>{g.descripcion}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {g.casos} caso{g.casos !== 1 ? 's' : ''} · {g.checkins} check-ins
                  </td>
                  <td style={{ padding: '12px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{g.tasa}%</span>
                    <span style={{ fontSize: 12, color: deltaColor, marginLeft: 8 }}>
                      {delta >= 0 ? '+' : ''}{delta} pts
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function CaracterizacionPoblacional({ poblacion, totalPoblacion }: { poblacion: CampoPoblacion[]; totalPoblacion: number }) {
  if (poblacion.length === 0) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center', color: 'var(--text-muted)', marginBottom: 24 }}>
        Aún no hay datos adicionales capturados para caracterizar la población.
      </div>
    )
  }
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Caracterización de la población</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 14, fontSize: 13 }}>
        {totalPoblacion} caso{totalPoblacion !== 1 ? 's' : ''} de la organización — conteo simple por categoría, sin filtrar por cumplimiento.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {poblacion.map(campo => (
          <div key={campo.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              {campo.label} <span style={{ opacity: 0.7 }}>({campo.total})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {campo.conteos.map(c => (
                <div key={c.valor}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                    <span>{c.valor}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{c.n} ({Math.round((c.n / campo.total) * 100)}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(c.n / campo.total) * 100}%`, background: 'var(--accent)', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function DemograficoPage() {
  const { baseline, mejores, peores, totalCasos, poblacion, totalPoblacion } = await getDatos()

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Estudio demográfico</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>
        Caracterización de la población y grupos con cumplimiento notablemente distinto al promedio.
      </p>

      <CaracterizacionPoblacional poblacion={poblacion} totalPoblacion={totalPoblacion} />

      <div style={{
        background: 'var(--warning)11', border: '1px solid var(--warning)', borderRadius: 12,
        padding: 14, marginBottom: 20, fontSize: 13, color: 'var(--text)', lineHeight: 1.5,
      }}>
        ⚠️ <b>Esto es correlación descriptiva, no causal.</b> Con {totalCasos} caso{totalCasos !== 1 ? 's' : ''} con datos de cumplimiento hoy, y estos campos apenas empezando a capturarse, los hallazgos son preliminares y deben revisarse a medida que crece la muestra. Solo se muestran grupos con al menos {MIN_CASOS} casos y {MIN_CHECKINS} check-ins.
      </div>

      {baseline == null ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          Aún no hay suficientes check-ins registrados para calcular el estudio.
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cumplimiento promedio general
            </span>
            <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>{baseline}%</div>
          </div>

          <div style={{ display: 'grid', gap: 20 }}>
            <TablaHallazgos titulo="Mejor cumplimiento" grupos={mejores} baseline={baseline} mejor />
            <TablaHallazgos titulo="Peor cumplimiento" grupos={peores} baseline={baseline} mejor={false} />
          </div>
        </>
      )}
    </div>
  )
}
