'use client'
import { useEffect, useState } from 'react'

type Fotos = { face: string | null; scene: string | null; reference: string | null }

const LABEL: Record<keyof Fotos, string> = {
  face: 'Selfie de verificación',
  scene: 'Escena capturada',
  reference: 'Foto de referencia',
}

export default function FotosViewer({ checkinId, hasPhotos }: { checkinId: string; hasPhotos: boolean }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fotos, setFotos] = useState<Fotos | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetch(`/api/checkins/${checkinId}/fotos`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? 'Error al cargar fotos')
        return res.json()
      })
      .then((data: Fotos) => setFotos(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, checkinId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { zoom ? setZoom(null) : setOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, zoom])

  if (!hasPhotos) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)',
          cursor: 'pointer',
        }}
      >
        Ver fotos
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', borderRadius: 12, padding: 24,
              maxWidth: 900, width: '100%', maxHeight: '90vh', overflowY: 'auto',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Evidencia fotográfica</h3>
              <button
                onClick={() => setOpen(false)}
                style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {loading && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando fotos…</div>
            )}
            {error && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>
            )}
            {fotos && !loading && !error && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {(Object.keys(LABEL) as (keyof Fotos)[]).map((key) => {
                  const url = fotos[key]
                  if (!url) return null
                  return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {LABEL[key]}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={LABEL[key]}
                        onClick={() => setZoom(url)}
                        style={{
                          width: '100%', aspectRatio: '4 / 3', objectFit: 'cover',
                          borderRadius: 10, border: '1px solid var(--border)', cursor: 'zoom-in',
                        }}
                      />
                    </div>
                  )
                })}
                {Object.values(fotos).every((v) => !v) && (
                  <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Sin fotos disponibles para este check-in.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}
    </>
  )
}
