import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'

interface Datos {
  genero?: string
  estrato?: number
  nivelEducativo?: string
  estadoCivil?: string
  ocupacion?: string
  tieneHijos?: boolean
  numHijos?: number
  regimenSalud?: string
  tenenciaVivienda?: string
  contactoEmergenciaNombre?: string
  contactoEmergenciaTelefono?: string
  contactoEmergenciaParentesco?: string
  movilidadReducida?: boolean
  condicionesMedicas?: string
  medicamentos?: string
}

const GENERO = ['Mujer', 'Hombre', 'Otro', 'Prefiere no decir']
const NIVEL_EDUCATIVO = ['Ninguno', 'Primaria', 'Bachiller', 'Técnico', 'Profesional', 'Posgrado']
const ESTADO_CIVIL = ['Soltero(a)', 'Casado(a)', 'Unión libre', 'Separado(a)', 'Divorciado(a)', 'Viudo(a)']
const OCUPACION = ['Empleado', 'Independiente', 'Desempleado', 'Estudiante', 'Ama de casa', 'Pensionado', 'Otro']
const REGIMEN_SALUD = ['Subsidiado', 'Contributivo', 'Especial', 'Ninguno']
const TENENCIA_VIVIENDA = ['Propia', 'Arriendo', 'Familiar']

function Chips({ options, value, onChange }: { options: string[]; value?: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.chipsRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, value === opt && styles.chipActive]}
          onPress={() => onChange(opt)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function Toggle({ label, value, onChange }: { label: string; value?: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={styles.toggleBtns}>
        <TouchableOpacity style={[styles.toggleBtn, value === true && styles.toggleBtnActive]} onPress={() => onChange(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.toggleBtnText, value === true && styles.toggleBtnTextActive]}>Sí</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, value === false && styles.toggleBtnActive]} onPress={() => onChange(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.toggleBtnText, value === false && styles.toggleBtnTextActive]}>No</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function OnboardingDatosAdicionales() {
  const { caseId, lat, lng, selfieBase64, checkpointsJson, facetecEnrolled } = useLocalSearchParams<{
    caseId: string; lat: string; lng: string; selfieBase64: string; checkpointsJson: string; facetecEnrolled: string
  }>()
  const router = useRouter()
  const [datos, setDatos] = useState<Datos>({})

  function set<K extends keyof Datos>(key: K, value: Datos[K]) {
    setDatos(prev => ({ ...prev, [key]: value }))
  }

  function continuar(datosAFinales: Datos) {
    router.push({
      pathname: `/(tecnico)/onboarding/${caseId}/confirmar`,
      params: {
        lat, lng, selfieBase64, checkpointsJson, facetecEnrolled,
        datosAdicionalesJson: JSON.stringify(datosAFinales),
      },
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>Datos adicionales</Text>
        <Text style={styles.title}>Información complementaria</Text>
        <Text style={styles.subtitle}>Opcional — ayuda al manejo judicial del caso. Puedes omitir este paso.</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}>
        {/* Perfil socioeconómico */}
        <View>
          <Text style={styles.sectionLabel}>Perfil socioeconómico</Text>
          <View style={{ gap: 14, marginTop: 10 }}>
            <View>
              <Text style={styles.fieldLabel}>Género</Text>
              <Chips options={GENERO} value={datos.genero} onChange={(v) => set('genero', v)} />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Estrato</Text>
              <Chips options={['1', '2', '3', '4', '5', '6']} value={datos.estrato ? String(datos.estrato) : undefined}
                onChange={(v) => set('estrato', Number(v))} />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Nivel educativo</Text>
              <Chips options={NIVEL_EDUCATIVO} value={datos.nivelEducativo} onChange={(v) => set('nivelEducativo', v)} />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Estado civil</Text>
              <Chips options={ESTADO_CIVIL} value={datos.estadoCivil} onChange={(v) => set('estadoCivil', v)} />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Ocupación</Text>
              <Chips options={OCUPACION} value={datos.ocupacion} onChange={(v) => set('ocupacion', v)} />
            </View>
            <Toggle label="¿Tiene hijos?" value={datos.tieneHijos} onChange={(v) => set('tieneHijos', v)} />
            {datos.tieneHijos === true && (
              <View>
                <Text style={styles.fieldLabel}>¿Cuántos?</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="Ej: 2"
                  placeholderTextColor="#4a6a8a"
                  value={datos.numHijos ? String(datos.numHijos) : ''}
                  onChangeText={(v) => set('numHijos', v ? Number(v) : undefined)}
                />
              </View>
            )}
            <View>
              <Text style={styles.fieldLabel}>Régimen de salud</Text>
              <Chips options={REGIMEN_SALUD} value={datos.regimenSalud} onChange={(v) => set('regimenSalud', v)} />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Tenencia de vivienda</Text>
              <Chips options={TENENCIA_VIVIENDA} value={datos.tenenciaVivienda} onChange={(v) => set('tenenciaVivienda', v)} />
            </View>
          </View>
        </View>

        {/* Contacto de emergencia */}
        <View>
          <Text style={styles.sectionLabel}>Contacto de emergencia</Text>
          <View style={{ gap: 10, marginTop: 10 }}>
            <TextInput
              style={styles.input}
              placeholder="Nombre completo"
              placeholderTextColor="#4a6a8a"
              value={datos.contactoEmergenciaNombre ?? ''}
              onChangeText={(v) => set('contactoEmergenciaNombre', v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Teléfono"
              placeholderTextColor="#4a6a8a"
              keyboardType="phone-pad"
              value={datos.contactoEmergenciaTelefono ?? ''}
              onChangeText={(v) => set('contactoEmergenciaTelefono', v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Parentesco (ej: madre, hermano...)"
              placeholderTextColor="#4a6a8a"
              value={datos.contactoEmergenciaParentesco ?? ''}
              onChangeText={(v) => set('contactoEmergenciaParentesco', v)}
            />
          </View>
        </View>

        {/* Condiciones médicas */}
        <View>
          <Text style={styles.sectionLabel}>Condiciones médicas</Text>
          <View style={{ gap: 10, marginTop: 10 }}>
            <Toggle label="¿Movilidad reducida?" value={datos.movilidadReducida} onChange={(v) => set('movilidadReducida', v)} />
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Condiciones médicas relevantes"
              placeholderTextColor="#4a6a8a"
              multiline
              value={datos.condicionesMedicas ?? ''}
              onChangeText={(v) => set('condicionesMedicas', v)}
            />
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Medicamentos"
              placeholderTextColor="#4a6a8a"
              multiline
              value={datos.medicamentos ?? ''}
              onChangeText={(v) => set('medicamentos', v)}
            />
          </View>
        </View>

        <View style={{ gap: 12, marginTop: 8 }}>
          <TouchableOpacity style={styles.nextBtn} onPress={() => continuar(datos)}>
            <Text style={styles.nextBtnText}>Continuar →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={() => continuar({})}>
            <Text style={styles.skipBtnText}>Omitir por ahora</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2236' },
  header: { padding: 24, paddingTop: 60, paddingBottom: 8 },
  step: { fontSize: 12, color: '#2563eb', fontWeight: '700', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#7a9bbf', lineHeight: 19 },
  sectionLabel: { fontSize: 12, color: '#7a9bbf', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  fieldLabel: { fontSize: 13, color: '#cbd5e1', marginBottom: 6, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#1a3a5c', borderRadius: 20, borderWidth: 1, borderColor: '#2563eb44' },
  chipActive: { backgroundColor: '#2563eb22', borderColor: '#2563eb' },
  chipText: { color: '#7a9bbf', fontSize: 13 },
  chipTextActive: { color: '#60a5fa', fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 13, color: '#cbd5e1', fontWeight: '600', flex: 1 },
  toggleBtns: { flexDirection: 'row', gap: 8 },
  toggleBtn: { paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#1a3a5c', borderRadius: 10, borderWidth: 1, borderColor: '#2563eb44' },
  toggleBtnActive: { backgroundColor: '#2563eb22', borderColor: '#2563eb' },
  toggleBtnText: { color: '#7a9bbf', fontSize: 13, fontWeight: '600' },
  toggleBtnTextActive: { color: '#60a5fa' },
  input: { backgroundColor: '#1a3a5c', borderRadius: 10, padding: 12, color: '#fff', borderWidth: 1, borderColor: '#2563eb33', fontSize: 14 },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  nextBtn: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  skipBtn: { padding: 12, alignItems: 'center' },
  skipBtnText: { color: '#4a6a8a', fontSize: 14 },
})
