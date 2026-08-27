import { useState, useRef, useCallback, useEffect } from 'react'
import { storeGet, storeSet } from './store'

// ── Types ──────────────────────────────────────────────────────────────────
interface Material { id: string; name: string; unit: string; price: number }
interface Acabado  { id: string; name: string; unit: string; price: number }

interface LineItem {
  id: string; materialId: string; description: string
  quantity: number; unitPrice: number; subtotal: number
}
interface AcabadoItem {
  id: string; acabadoId: string; name: string
  selected: boolean; quantity: number; unitPrice: number; subtotal: number
}
interface Quote {
  id: string; number: string; date: string
  clientName: string; clientContact: string; clientEmail: string; notes: string
  items: LineItem[]; acabados: AcabadoItem[]
  discountType: 'percent' | 'amount'
  discount: number; ivaRate: number
  itemsSubtotal: number; acabadosSubtotal: number
  subtotal: number; discountAmount: number; ivaAmount: number; total: number
  status: 'draft' | 'sent' | 'approved'
  savedAt?: string
}
type View = 'quotes' | 'editor' | 'materials' | 'print'

// ── Helpers ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9)

const formatCRC = (n: number) =>
  '₡' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const today = () => new Date().toISOString().split('T')[0]

const emptyItems = (): LineItem[] =>
  Array.from({ length: 20 }, () => ({
    id: uid(), materialId: '', description: '', quantity: 0, unitPrice: 0, subtotal: 0,
  }))

const emptyAcabados = (defs: Acabado[]): AcabadoItem[] =>
  defs.map((a) => ({
    id: uid(), acabadoId: a.id, name: a.name,
    selected: false, quantity: 1, unitPrice: a.price, subtotal: 0,
  }))

const recalcTotals = (q: Quote): Quote => {
  const itemsSub = q.items.reduce((s, i) => s + i.subtotal, 0)
  const acabSub  = q.acabados.filter((a) => a.selected).reduce((s, a) => s + a.subtotal, 0)
  const sub  = itemsSub + acabSub
  const disc = q.discountType === 'percent' ? sub * (q.discount / 100) : q.discount
  const base = sub - disc
  const iva  = base * (q.ivaRate / 100)
  return { ...q, itemsSubtotal: itemsSub, acabadosSubtotal: acabSub, subtotal: sub, discountAmount: disc, ivaAmount: iva, total: base + iva }
}

const newQuote = (n: number, acabados: Acabado[]): Quote =>
  recalcTotals({
    id: uid(), number: `COT-${String(n).padStart(4, '0')}`, date: today(),
    clientName: '', clientContact: '', clientEmail: '', notes: '',
    items: emptyItems(), acabados: emptyAcabados(acabados),
    discountType: 'percent', discount: 0, ivaRate: 13,
    itemsSubtotal: 0, acabadosSubtotal: 0,
    subtotal: 0, discountAmount: 0, ivaAmount: 0, total: 0, status: 'draft',
  })


// ── Seed data (used only on first run) ────────────────────────────────────
const SEED_MATS: Material[] = [
  { id: uid(), name: 'Impresión Digital Color A4',       unit: 'hoja',    price: 450   },
  { id: uid(), name: 'Impresión Digital B/N A4',         unit: 'hoja',    price: 50    },
  { id: uid(), name: 'Impresión Digital Color Carta',    unit: 'hoja',    price: 110   },
  { id: uid(), name: 'Impresión Digital B/N Carta',      unit: 'hoja',    price: 40    },
  { id: uid(), name: 'Impresión Digital Color Tabloide', unit: 'hoja',    price: 280   },
  { id: uid(), name: 'Lona Vinílica Backlit',            unit: 'm²',      price: 2800  },
  { id: uid(), name: 'Lona Mesh',                        unit: 'm²',      price: 2200  },
  { id: uid(), name: 'Vinil Adhesivo',                   unit: 'm²',      price: 1800  },
  { id: uid(), name: 'Fotopapel Brillante',              unit: 'hoja',    price: 380   },
  { id: uid(), name: 'Fotopapel Mate',                   unit: 'hoja',    price: 350   },
  { id: uid(), name: 'Tarjetas de Presentación (100)',   unit: 'paquete', price: 3800  },
  { id: uid(), name: 'Folleto Díptico',                  unit: 'pieza',   price: 220   },
  { id: uid(), name: 'Afiche 50×70 cm',                  unit: 'pieza',   price: 950   },
  { id: uid(), name: 'Banner Rollo-Up',                  unit: 'pieza',   price: 18500 },
  { id: uid(), name: 'Camiseta Transfer',                unit: 'pieza',   price: 2200  },
]
const SEED_ACABADOS: Acabado[] = [
  { id: uid(), name: 'Plastificado Brillo',  unit: 'hoja',  price: 180 },
  { id: uid(), name: 'Plastificado Mate',    unit: 'hoja',  price: 180 },
  { id: uid(), name: 'Barniz UV',            unit: 'hoja',  price: 220 },
  { id: uid(), name: 'Troquelado',           unit: 'pieza', price: 350 },
  { id: uid(), name: 'Perforado',            unit: 'pieza', price: 120 },
  { id: uid(), name: 'Encuadernado Espiral', unit: 'pieza', price: 550 },
  { id: uid(), name: 'Grampado',             unit: 'pieza', price: 80  },
  { id: uid(), name: 'Corte y Sangrado',     unit: 'pieza', price: 250 },
  { id: uid(), name: 'Laminado Mate',        unit: 'm²',    price: 900 },
  { id: uid(), name: 'Doblez',              unit: 'pieza', price: 60  },
]

// ── Theme ─────────────────────────────────────────────────────────────────
const C = {
  black: '#111111', dark: '#1e1e1e',
  orange: '#f97316', red: '#dc2626',
  yellow: '#facc15', white: '#ffffff',
  muted: '#6b6b6b', border: '#2e2e2e',
}

// ── Shared Button ──────────────────────────────────────────────────────────
const Btn = ({ children, onClick, color = 'orange', small = false, style = {}, disabled = false }: {
  children: React.ReactNode; onClick?: () => void
  color?: 'orange' | 'red' | 'yellow' | 'ghost' | 'green'
  small?: boolean; style?: React.CSSProperties; disabled?: boolean
}) => {
  const bg = color === 'orange' ? C.orange : color === 'red' ? C.red
    : color === 'yellow' ? C.yellow : color === 'green' ? '#16a34a'
    : 'rgba(255,255,255,0.08)'
  const tx = color === 'yellow' ? C.black : color === 'ghost' ? '#ccc' : C.white
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background: bg, color: tx, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'Inter, sans-serif', fontWeight: 600, borderRadius: 8,
        padding: small ? '5px 12px' : '8px 18px', fontSize: small ? 12 : 13,
        opacity: disabled ? 0.5 : 1, transition: 'opacity .15s', ...style }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = '0.85' }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.opacity = '1' }}
    >{children}</button>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  // Company info — persisted
  const [banner,         setBanner]         = useState<string | null>(() => storeGet('cp_banner', null))
  const [companyName,    setCompanyName]    = useState(() => storeGet('cp_name',    'Mi Centro de Impresión'))
  const [companyTag,     setCompanyTag]     = useState(() => storeGet('cp_tag',     'Calidad • Precisión • Entrega Rápida'))
  const [companyPhone,   setCompanyPhone]   = useState(() => storeGet('cp_phone',   ''))
  const [companyEmail,   setCompanyEmail]   = useState(() => storeGet('cp_email',   ''))
  const [companyAddress, setCompanyAddress] = useState(() => storeGet('cp_address', ''))
  const [editCo,         setEditCo]         = useState(false)

  // Materials & acabados — persisted
  const [materials, setMaterials] = useState<Material[]>(() => storeGet('cp_materials', SEED_MATS))
  const [acabados,  setAcabados]  = useState<Acabado[]>(() =>  storeGet('cp_acabados',  SEED_ACABADOS))
  const [matSaved,  setMatSaved]  = useState(false)

  // Quotes — persisted
  const [quotes,   setQuotes]   = useState<Quote[]>(() => storeGet('cp_quotes', []))
  const [activeQ,  setActiveQ]  = useState<Quote | null>(null)
  const [view,     setView]     = useState<View>('quotes')

  const bannerRef  = useRef<HTMLInputElement>(null)
  const quoteCount = useRef<number>(storeGet('cp_quote_counter', 1))

  // Save company info when user clicks "Guardar empresa"
  const saveCompany = () => {
    storeSet('cp_name',    companyName)
    storeSet('cp_tag',     companyTag)
    storeSet('cp_phone',   companyPhone)
    storeSet('cp_email',   companyEmail)
    storeSet('cp_address', companyAddress)
    setEditCo(false)
  }

  const handleBanner = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = (ev) => {
      const data = ev.target?.result as string
      setBanner(data)
      storeSet('cp_banner', data)
      // reset input so same file can be re-selected
      e.target.value = ''
    }
    r.readAsDataURL(f)
  }, [])

  // Save materials & acabados to localStorage
  const saveMaterials = () => {
    storeSet('cp_materials', materials)
    storeSet('cp_acabados',  acabados)
    setMatSaved(true)
    setTimeout(() => setMatSaved(false), 2500)
  }

  // Quote ops
  const createQuote = () => {
    const n = storeGet('cp_quote_counter', 1)
    const q = newQuote(n, acabados)
    storeSet('cp_quote_counter', n + 1)
    quoteCount.current = n + 1
    setQuotes((p) => [q, ...p])
    setActiveQ(q)
    setView('editor')
  }

  const saveQuote = (q: Quote) => {
    const saved = { ...q, savedAt: new Date().toLocaleString('es-CR') }
    const updated = (prev: Quote[]) => {
      const exists = prev.find((x) => x.id === saved.id)
      const next = exists ? prev.map((x) => x.id === saved.id ? saved : x) : [saved, ...prev]
      storeSet('cp_quotes', next)
      return next
    }
    setQuotes(updated)
    setActiveQ(saved)
  }

  const deleteQuote = (id: string) => {
    setQuotes((p) => {
      const next = p.filter((x) => x.id !== id)
      storeSet('cp_quotes', next)
      return next
    })
    if (activeQ?.id === id) { setActiveQ(null); setView('quotes') }
  }

  const openQuote = (q: Quote) => { setActiveQ(q); setView('editor') }

  // Materials ops
  const addMat  = () => setMaterials((p) => [...p, { id: uid(), name: '', unit: 'pieza', price: 0 }])
  const updMat  = (id: string, f: keyof Material, v: string | number) =>
    setMaterials((p) => p.map((m) => m.id === id ? { ...m, [f]: v } : m))
  const delMat  = (id: string) => setMaterials((p) => p.filter((m) => m.id !== id))

  // Acabados ops
  const addAcab = () => setAcabados((p) => [...p, { id: uid(), name: '', unit: 'pieza', price: 0 }])
  const updAcab = (id: string, f: keyof Acabado, v: string | number) =>
    setAcabados((p) => p.map((a) => a.id === id ? { ...a, [f]: v } : a))
  const delAcab = (id: string) => setAcabados((p) => p.filter((a) => a.id !== id))

  const coInfo = { companyName, companyTag, companyPhone, companyEmail, companyAddress, banner }

 return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.dark }}>
      {/* ── Header ── */}
      <header className="no-print" style={{ background: C.black, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Logo */}
    {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <img src="mi-logo.png" style={{ height: 32, objectFit: 'contain' }} alt="Logo" />
          </div>


          <div style={{ width: 1, height: 32, background: C.border, margin: '0 4px' }} />

          {/* Banner upload */}
          <button onClick={() => bannerRef.current?.click()}
            style={{ background: '#222', border: `2px dashed ${C.orange}`, borderRadius: 8, padding: '5px 14px',
              color: C.orange, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {banner ? '🖼 Cambiar imagen empresa' : '🖼 Subir imagen empresa'}
          </button>
          <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBanner} />

          <div style={{ flex: 1 }}>
            {editCo ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {[
                  [companyName,    setCompanyName,    'Nombre empresa',  220],
                  [companyTag,     setCompanyTag,     'Slogan',          200],
                  [companyPhone,   setCompanyPhone,   'Teléfono',        130],
                  [companyEmail,   setCompanyEmail,   'Email',           170],
                  [companyAddress, setCompanyAddress, 'Dirección',       200],
                ].map(([val, setter, ph, w]) => (
                  <input key={ph as string} value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                    placeholder={ph as string}
                    style={{ background: '#222', border: `1px solid #444`, borderRadius: 6, padding: '5px 10px',
                      color: C.white, fontSize: 12, width: w as number }} />
                ))}
              </div>
            ) : (
              <span style={{ color: '#aaa', fontSize: 13 }}>
                {companyName} {companyTag && <span style={{ color: '#555' }}>— {companyTag}</span>}
              </span>
            )}
          </div>

          <Btn color={editCo ? 'green' : 'ghost'} small onClick={editCo ? saveCompany : () => setEditCo(true)}>
            {editCo ? '✓ Guardar empresa' : '✏ Editar empresa'}
          </Btn>
        </div>

        {/* Nav */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 4 }}>
          {([['quotes', '📋 Cotizaciones'], ['materials', '📦 Materiales y Acabados']] as [View, string][]).map(([v, lbl]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                borderRadius: '7px 7px 0 0', background: view === v ? C.dark : 'transparent',
                color: view === v ? C.orange : '#888', transition: 'all .15s' }}>
              {lbl}
            </button>
          ))}
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 1200, margin: '0 auto', width: '100%', padding: '28px 24px' }}>
        {view === 'quotes' && (
          <QuotesList quotes={quotes} onCreate={createQuote} onOpen={openQuote} onDelete={deleteQuote} />
        )}
        {view === 'editor' && activeQ && (
          <QuoteEditor key={activeQ.id} quote={activeQ} materials={materials} acabadosDef={acabados}
            onSave={saveQuote} onBack={() => setView('quotes')} onPrint={() => setView('print')} coInfo={coInfo} />
        )}
        {view === 'materials' && (
          <MaterialsEditor
            materials={materials} acabados={acabados} saved={matSaved}
            onAddMat={addMat} onUpdMat={updMat} onDelMat={delMat}
            onAddAcab={addAcab} onUpdAcab={updAcab} onDelAcab={delAcab}
            onSave={saveMaterials}
          />
        )}
        {view === 'print' && activeQ && (
          <PrintView quote={activeQ} materials={materials} coInfo={coInfo} onBack={() => setView('editor')} />
        )}
      </main>
    </div>
  )
}

// ── Quotes List ─────────────────────────────────────────────────────────────
function QuotesList({ quotes, onCreate, onOpen, onDelete }: {
  quotes: Quote[]; onCreate: () => void
  onOpen: (q: Quote) => void; onDelete: (id: string) => void
}) {
  const ss: Record<Quote['status'], { bg: string; color: string; label: string }> = {
    draft:    { bg: '#2a2a2a', color: '#888',    label: 'Borrador' },
    sent:     { bg: '#1e3a5f', color: '#60a5fa', label: 'Enviada'  },
    approved: { bg: '#14532d', color: '#4ade80', label: 'Aprobada' },
  }
  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: C.white, fontSize: 24, fontWeight: 700, margin: 0 }}>Cotizaciones guardadas</h2>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>{quotes.length} cotización{quotes.length !== 1 ? 'es' : ''}</p>
        </div>
        <Btn onClick={onCreate}>+ Nueva Cotización</Btn>
      </div>

      {quotes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>
          <div style={{ fontSize: 52 }}>📋</div>
          <p style={{ fontSize: 16, marginTop: 12 }}>No hay cotizaciones guardadas</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Las cotizaciones que guardes aparecerán aquí y se conservarán al cerrar el programa</p>
        </div>
      ) : (
        <div style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.black }}>
                {['Número', 'Fecha', 'Cliente', 'Subtotal', 'Total', 'Estado', 'Guardada', 'Acciones'].map((h) => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                    color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'JetBrains Mono, monospace' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q, i) => {
                const s = ss[q.status]
                return (
                  <tr key={q.id} onClick={() => onOpen(q)}
                    style={{ cursor: 'pointer', borderTop: '1px solid #2a2a2a', transition: 'background .12s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#222')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '11px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: C.orange, fontWeight: 700 }}>{q.number}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#aaa' }}>{q.date}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: C.white, fontWeight: 500 }}>
                      {q.clientName || <span style={{ color: '#555' }}>Sin nombre</span>}
                    </td>
                    <td style={{ padding: '11px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#888' }}>{formatCRC(q.subtotal)}</td>
                    <td style={{ padding: '11px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: C.yellow, fontWeight: 700 }}>{formatCRC(q.total)}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: '#555' }}>{q.savedAt || '—'}</td>
                    <td style={{ padding: '11px 14px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn small onClick={() => onOpen(q)}>✏ Abrir</Btn>
                        <Btn small color="red" onClick={() => { if (confirm('¿Eliminar esta cotización?')) onDelete(q.id) }}>Eliminar</Btn>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: '#1a1a1a', border: `1px solid ${C.border}`, color: '#555', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>💾</span>
        Todas las cotizaciones se guardan automáticamente al presionar <strong style={{ color: '#888' }}>Guardar</strong> y se conservan cuando cierras el programa.
      </div>
    </div>
  )
}

// ── Quote Editor ─────────────────────────────────────────────────────────────
function QuoteEditor({ quote, materials, acabadosDef, onSave, onBack, onPrint, coInfo }: {
  quote: Quote; materials: Material[]; acabadosDef: Acabado[]
  onSave: (q: Quote) => void; onBack: () => void; onPrint: () => void
  coInfo: { companyName: string; companyTag: string; companyPhone: string; companyEmail: string; companyAddress: string; banner: string | null }
}) {
  const [q, setQ] = useState<Quote>(() => ({
    ...quote,
    acabados: quote.acabados.length > 0 ? quote.acabados : emptyAcabados(acabadosDef),
  }))
  const [justSaved, setJustSaved] = useState(false)

  const upd = <K extends keyof Quote>(k: K, v: Quote[K]) =>
    setQ((p) => recalcTotals({ ...p, [k]: v }))

  const updItem = (idx: number, field: keyof LineItem, value: string | number) =>
    setQ((p) => {
      const items = p.items.map((item, i) => {
        if (i !== idx) return item
        const u = { ...item, [field]: value }
        if (field === 'materialId') {
          const mat = materials.find((m) => m.id === value)
          u.unitPrice   = mat?.price ?? item.unitPrice
          u.description = mat?.name  ?? item.description
        }
        u.subtotal = (field === 'quantity' ? Number(value) : u.quantity) *
                     (field === 'unitPrice' ? Number(value) : u.unitPrice)
        return u
      })
      return recalcTotals({ ...p, items })
    })

  const updAcab = (idx: number, field: keyof AcabadoItem, value: string | number | boolean) =>
    setQ((p) => {
      const acabados = p.acabados.map((a, i) => {
        if (i !== idx) return a
        const u = { ...a, [field]: value }
        u.subtotal = u.selected
          ? (field === 'quantity' ? Number(value) : u.quantity) *
            (field === 'unitPrice' ? Number(value) : u.unitPrice)
          : 0
        return u
      })
      return recalcTotals({ ...p, acabados })
    })

  const handleSave = () => {
    onSave(q)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2500)
  }

  const inputSt: React.CSSProperties = {
    background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 7,
    padding: '7px 10px', fontSize: 12, color: '#111', fontFamily: 'Inter, sans-serif', width: '100%',
  }
  const thSt: React.CSSProperties = {
    padding: '9px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.07em', color: '#fff',
    fontFamily: 'JetBrains Mono, monospace', background: C.black,
  }

  return (
    <div className="fade-in">
      {/* Toolbar */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13 }}>
          ← Volver a cotizaciones
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {justSaved && (
            <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              ✓ Guardada correctamente
            </span>
          )}
          <select value={q.status} onChange={(e) => upd('status', e.target.value as Quote['status'])}
            style={{ background: '#222', border: `1px solid #444`, borderRadius: 8, padding: '7px 12px', color: C.white, fontSize: 13 }}>
            <option value="draft">Borrador</option>
            <option value="sent">Enviada</option>
            <option value="approved">Aprobada</option>
          </select>
          <Btn color="green" onClick={handleSave}>💾 Guardar cotización</Btn>
          <Btn onClick={() => { handleSave(); onPrint() }}>🖨 Ver PDF</Btn>
        </div>
      </div>

      {/* Document */}
      <div style={{ background: C.white, borderRadius: 12, overflow: 'hidden', border: `1px solid #e0e0e0` }}>
        {/* Banner */}
        <div style={{ position: 'relative', width: '100%', height: 150, overflow: 'hidden', cursor: 'pointer',
          background: coInfo.banner ? 'transparent' : `linear-gradient(135deg, ${C.black} 0%, #3a1a00 50%, ${C.orange} 100%)` }}>
          {coInfo.banner
            ? <img src={coInfo.banner} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: C.white, fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>{coInfo.companyName.toUpperCase()}</span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 }}>{coInfo.companyTag}</span>
              </div>
          }
        </div>

        {/* Quote meta */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', background: C.black }}>
          <div>
            <div style={{ color: '#aaa', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>Cotización</div>
            <div style={{ color: C.orange, fontSize: 26, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>{q.number}</div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#666', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Fecha</label>
            <input type="date" value={q.date} onChange={(e) => upd('date', e.target.value)}
              style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 7, padding: '6px 10px', color: C.white, fontSize: 13 }} />
          </div>
        </div>

        {/* Client */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #eee', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>Datos del Cliente</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={q.clientName}    onChange={(e) => upd('clientName',    e.target.value)} placeholder="Nombre o empresa del cliente" style={inputSt} />
              <input value={q.clientContact} onChange={(e) => upd('clientContact', e.target.value)} placeholder="Contacto / Atención a..." style={inputSt} />
              <input value={q.clientEmail}   onChange={(e) => upd('clientEmail',   e.target.value)} placeholder="Correo electrónico" style={inputSt} />
            </div>
          </div>
          <div>
            <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>Notas / Condiciones</p>
            <textarea value={q.notes} onChange={(e) => upd('notes', e.target.value)} rows={4}
              placeholder="Validez, condiciones de entrega, métodos de pago..."
              style={{ ...inputSt, resize: 'vertical', fontFamily: 'Inter, sans-serif' }} />
          </div>
        </div>

        {/* Items table */}
        <div style={{ padding: '20px 28px 0' }}>
          <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>Productos / Servicios</p>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thSt, width: 32 }}>#</th>
                  <th style={{ ...thSt, minWidth: 170 }}>Material</th>
                  <th style={{ ...thSt }}>Descripción</th>
                  <th style={{ ...thSt, width: 80,  textAlign: 'right' }}>Cant.</th>
                  <th style={{ ...thSt, width: 120, textAlign: 'right' }}>P. Unit. ₡</th>
                  <th style={{ ...thSt, width: 130, textAlign: 'right' }}>Subtotal ₡</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0', background: idx % 2 === 0 ? C.white : '#fafafa' }}>
                    <td style={{ padding: '5px 10px', fontSize: 11, color: '#bbb', fontFamily: 'JetBrains Mono, monospace' }}>{idx + 1}</td>
                    <td style={{ padding: '4px 6px' }}>
                      <select value={item.materialId} onChange={(e) => updItem(idx, 'materialId', e.target.value)}
                        style={{ ...inputSt, fontSize: 12, padding: '6px 8px' }}>
                        <option value="">— Seleccionar —</option>
                        {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input value={item.description} onChange={(e) => updItem(idx, 'description', e.target.value)}
                        placeholder="Descripción o especificaciones..." style={{ ...inputSt, fontSize: 12 }} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input type="number" min="0" value={item.quantity || ''} onChange={(e) => updItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="0" style={{ ...inputSt, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input type="number" min="0" step="1" value={item.unitPrice || ''} onChange={(e) => updItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        placeholder="0" style={{ ...inputSt, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }} />
                    </td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, color: item.subtotal > 0 ? C.black : '#ccc' }}>
                      {item.subtotal > 0 ? formatCRC(item.subtotal) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Acabados */}
        <div style={{ padding: '20px 28px 0', marginTop: 16 }}>
          <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>Acabados</p>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thSt, width: 48, textAlign: 'center' }}>✓</th>
                  <th style={{ ...thSt }}>Acabado</th>
                  <th style={{ ...thSt, width: 80,  textAlign: 'right' }}>Cant.</th>
                  <th style={{ ...thSt, width: 120, textAlign: 'right' }}>P. Unit. ₡</th>
                  <th style={{ ...thSt, width: 130, textAlign: 'right' }}>Subtotal ₡</th>
                </tr>
              </thead>
              <tbody>
                {q.acabados.map((a, idx) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0', background: a.selected ? '#fff8f0' : (idx % 2 === 0 ? C.white : '#fafafa'), opacity: a.selected ? 1 : 0.65 }}>
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                      <input type="checkbox" checked={a.selected} onChange={(e) => updAcab(idx, 'selected', e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: C.orange, cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '4px 10px', fontSize: 13, fontWeight: a.selected ? 600 : 400, color: a.selected ? C.black : '#666' }}>{a.name}</td>
                    <td style={{ padding: '4px 6px' }}>
                      <input type="number" min="0" value={a.quantity || ''} onChange={(e) => updAcab(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        disabled={!a.selected} placeholder="1"
                        style={{ ...inputSt, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', opacity: a.selected ? 1 : 0.4 }} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input type="number" min="0" step="1" value={a.unitPrice || ''} onChange={(e) => updAcab(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        disabled={!a.selected} placeholder="0"
                        style={{ ...inputSt, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', opacity: a.selected ? 1 : 0.4 }} />
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: a.selected ? C.orange : '#ccc' }}>
                      {a.selected && a.subtotal > 0 ? formatCRC(a.subtotal) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial summary */}
        <div style={{ padding: '20px 28px 28px', display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <div style={{ background: C.black, borderRadius: 14, padding: '22px 28px', minWidth: 320, color: C.white }}>
            <Row label="Subtotal productos"  val={formatCRC(q.itemsSubtotal)} />
            {q.acabadosSubtotal > 0 && <Row label="Subtotal acabados" val={formatCRC(q.acabadosSubtotal)} color={C.orange} />}
            <div style={{ borderTop: '1px solid #333', margin: '8px 0' }} />
            <Row label="SUBTOTAL" val={formatCRC(q.subtotal)} bold />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ color: '#aaa', fontSize: 12, flex: 1 }}>Descuento</span>
              <select value={q.discountType} onChange={(e) => upd('discountType', e.target.value as 'percent' | 'amount')}
                style={{ background: '#222', border: '1px solid #444', borderRadius: 6, padding: '4px 8px', color: C.white, fontSize: 12 }}>
                <option value="percent">%</option>
                <option value="amount">₡</option>
              </select>
              <input type="number" min="0" value={q.discount || ''} onChange={(e) => upd('discount', parseFloat(e.target.value) || 0)}
                placeholder="0" style={{ background: '#222', border: '1px solid #444', borderRadius: 6, padding: '4px 8px', color: C.white, fontSize: 12, width: 80, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }} />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: C.red, minWidth: 90, textAlign: 'right' }}>-{formatCRC(q.discountAmount)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 12, borderBottom: '2px solid #333' }}>
              <span style={{ color: '#aaa', fontSize: 12, flex: 1 }}>IVA</span>
              <input type="number" min="0" max="100" step="0.5" value={q.ivaRate} onChange={(e) => upd('ivaRate', parseFloat(e.target.value) || 0)}
                style={{ background: '#222', border: '1px solid #444', borderRadius: 6, padding: '4px 8px', color: C.white, fontSize: 12, width: 60, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }} />
              <span style={{ color: '#aaa', fontSize: 12 }}>%</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#aaa', minWidth: 90, textAlign: 'right' }}>{formatCRC(q.ivaAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 16 }}>TOTAL</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 800, color: C.yellow }}>{formatCRC(q.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Materials + Acabados Editor ──────────────────────────────────────────────
function MaterialsEditor({ materials, acabados, saved, onAddMat, onUpdMat, onDelMat, onAddAcab, onUpdAcab, onDelAcab, onSave }: {
  materials: Material[]; acabados: Acabado[]; saved: boolean
  onAddMat: () => void; onUpdMat: (id: string, f: keyof Material, v: string | number) => void; onDelMat: (id: string) => void
  onAddAcab: () => void; onUpdAcab: (id: string, f: keyof Acabado, v: string | number) => void; onDelAcab: (id: string) => void
  onSave: () => void
}) {
  const [tab, setTab] = useState<'mats' | 'acab'>('mats')
  const inp: React.CSSProperties = { background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: 7, padding: '7px 10px', color: C.white, fontSize: 12, fontFamily: 'Inter, sans-serif', width: '100%' }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.white, fontSize: 22, fontWeight: 700, margin: 0 }}>Base de Datos de Precios</h2>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>Los cambios se guardan al presionar el botón Guardar</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓ Cambios guardados</span>}
          {tab === 'mats' && <Btn onClick={onAddMat} color="orange">+ Agregar Material</Btn>}
          {tab === 'acab' && <Btn onClick={onAddAcab} color="yellow">+ Agregar Acabado</Btn>}
          <Btn color="green" onClick={onSave}>💾 Guardar cambios</Btn>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: C.black, borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 16 }}>
        {([['mats', '📦 Materiales'], ['acab', '✨ Acabados']] as ['mats' | 'acab', string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '7px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: tab === t ? C.orange : 'transparent', color: tab === t ? C.white : '#777', transition: 'all .15s' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.black }}>
              {['Nombre', 'Unidad', 'Precio (₡)', 'Acción'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'JetBrains Mono, monospace' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tab === 'mats' && materials.map((m) => (
              <tr key={m.id} style={{ borderTop: '1px solid #2a2a2a' }}>
                <td style={{ padding: '8px 12px' }}><input value={m.name} onChange={(e) => onUpdMat(m.id, 'name', e.target.value)} placeholder="Nombre del material" style={inp} /></td>
                <td style={{ padding: '8px 12px' }}><input value={m.unit} onChange={(e) => onUpdMat(m.id, 'unit', e.target.value)} style={{ ...inp, width: 110 }} /></td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: C.orange, fontWeight: 700 }}>₡</span>
                    <input type="number" min="0" value={m.price} onChange={(e) => onUpdMat(m.id, 'price', parseFloat(e.target.value) || 0)}
                      style={{ ...inp, width: 130, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }} />
                  </div>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <Btn small color="red" onClick={() => { if (confirm('¿Eliminar?')) onDelMat(m.id) }}>Eliminar</Btn>
                </td>
              </tr>
            ))}
            {tab === 'acab' && acabados.map((a) => (
              <tr key={a.id} style={{ borderTop: '1px solid #2a2a2a' }}>
                <td style={{ padding: '8px 12px' }}><input value={a.name} onChange={(e) => onUpdAcab(a.id, 'name', e.target.value)} placeholder="Nombre del acabado" style={inp} /></td>
                <td style={{ padding: '8px 12px' }}><input value={a.unit} onChange={(e) => onUpdAcab(a.id, 'unit', e.target.value)} style={{ ...inp, width: 110 }} /></td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: C.yellow, fontWeight: 700 }}>₡</span>
                    <input type="number" min="0" value={a.price} onChange={(e) => onUpdAcab(a.id, 'price', parseFloat(e.target.value) || 0)}
                      style={{ ...inp, width: 130, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }} />
                  </div>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <Btn small color="red" onClick={() => { if (confirm('¿Eliminar?')) onDelAcab(a.id) }}>Eliminar</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: '#1a1400', border: `1px solid ${C.yellow}33`, color: '#c8a800', fontSize: 13 }}>
        💡 Presiona <strong>💾 Guardar cambios</strong> para que los precios y materiales se conserven cuando cierres el programa.
      </div>
    </div>
  )
}

// ── Print / PDF View ──────────────────────────────────────────────────────────
function PrintView({ quote, materials, coInfo, onBack }: {
  quote: Quote; materials: Material[]
  coInfo: { companyName: string; companyTag: string; companyPhone: string; companyEmail: string; companyAddress: string; banner: string | null }
  onBack: () => void
}) {
  const docRef = useRef<HTMLDivElement>(null)
  const filledItems    = quote.items.filter((it) => it.quantity > 0 || it.description)
  const filledAcabados = quote.acabados.filter((a) => a.selected)

  const handlePDF = async () => {
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF }       = await import('jspdf')
    if (!docRef.current) return
    const canvas  = await html2canvas(docRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW   = pdf.internal.pageSize.getWidth()
    const pageH   = pdf.internal.pageSize.getHeight()
    const imgH    = pageW * (canvas.height / canvas.width)
    if (imgH <= pageH) {
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, imgH)
    } else {
      let y = 0
      while (y < imgH) { if (y > 0) pdf.addPage(); pdf.addImage(imgData, 'JPEG', 0, -y, pageW, imgH); y += pageH }
    }
    pdf.save(`${quote.number}-${quote.clientName || 'cotizacion'}.pdf`)
  }

  const tdSt: React.CSSProperties = { padding: '7px 10px', fontSize: 12, color: '#222', borderBottom: '1px solid #eee' }
  const thSt: React.CSSProperties = { padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#fff', fontFamily: 'JetBrains Mono, monospace', background: C.black }

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <Btn color="ghost" onClick={onBack}>← Volver</Btn>
        <Btn color="orange" onClick={handlePDF}>⬇ Descargar PDF</Btn>
        <Btn color="ghost" onClick={() => window.print()}>🖨 Imprimir</Btn>
      </div>

      <div ref={docRef} className="print-doc" style={{ background: C.white, maxWidth: 860, margin: '0 auto', borderRadius: 12, overflow: 'hidden', border: '1px solid #ddd' }}>
        {/* Banner */}
        <div style={{ width: '100%', height: 150, overflow: 'hidden', background: coInfo.banner ? 'transparent' : `linear-gradient(135deg, ${C.black} 0%, #3a1a00 50%, ${C.orange} 100%)` }}>
          {coInfo.banner
            ? <img src={coInfo.banner} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: C.white, fontSize: 28, fontWeight: 800, letterSpacing: 3 }}>{coInfo.companyName.toUpperCase()}</span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 6 }}>{coInfo.companyTag}</span>
              </div>
          }
        </div>

        {/* Meta bar */}
        <div style={{ background: C.black, padding: '12px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 18 }}>
            {coInfo.companyPhone   && <span style={{ color: '#aaa', fontSize: 12 }}>📞 {coInfo.companyPhone}</span>}
            {coInfo.companyEmail   && <span style={{ color: '#aaa', fontSize: 12 }}>✉ {coInfo.companyEmail}</span>}
            {coInfo.companyAddress && <span style={{ color: '#aaa', fontSize: 12 }}>📍 {coInfo.companyAddress}</span>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: C.orange, fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>{quote.number}</div>
            <div style={{ color: '#888', fontSize: 11 }}>Fecha: {quote.date}</div>
          </div>
        </div>

        {/* Client */}
        <div style={{ padding: '18px 28px', borderBottom: '2px solid #f0f0f0', background: '#fafafa' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Para</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.black }}>{quote.clientName || '—'}</div>
          {quote.clientContact && <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{quote.clientContact}</div>}
          {quote.clientEmail   && <div style={{ fontSize: 13, color: '#555' }}>{quote.clientEmail}</div>}
        </div>

        {/* Items */}
        {filledItems.length > 0 && (
          <div style={{ padding: '18px 28px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#999', marginBottom: 8 }}>Productos / Servicios</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['#', 'Descripción', 'Cant.', 'P. Unit.', 'Subtotal'].map((h, i) => <th key={h} style={{ ...thSt, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
              <tbody>
                {filledItems.map((item, idx) => {
                  const mat = materials.find((m) => m.id === item.materialId)
                  return (
                    <tr key={item.id} style={{ background: idx % 2 === 0 ? C.white : '#fafafa' }}>
                      <td style={{ ...tdSt, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#bbb', width: 32 }}>{idx + 1}</td>
                      <td style={tdSt}>
                        <div style={{ fontWeight: 600 }}>{item.description || mat?.name || '—'}</div>
                        {mat && item.description && item.description !== mat.name && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{mat.name}</div>}
                      </td>
                      <td style={{ ...tdSt, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{item.quantity} {mat?.unit || ''}</td>
                      <td style={{ ...tdSt, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{formatCRC(item.unitPrice)}</td>
                      <td style={{ ...tdSt, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{formatCRC(item.subtotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Acabados */}
        {filledAcabados.length > 0 && (
          <div style={{ padding: '18px 28px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.orange, marginBottom: 8 }}>Acabados</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Acabado', 'Cant.', 'P. Unit.', 'Subtotal'].map((h, i) => <th key={h} style={{ ...thSt, textAlign: i >= 1 ? 'right' : 'left', background: '#2a1800' }}>{h}</th>)}</tr></thead>
              <tbody>
                {filledAcabados.map((a, idx) => (
                  <tr key={a.id} style={{ background: idx % 2 === 0 ? '#fffbf5' : C.white }}>
                    <td style={tdSt}><span style={{ fontWeight: 600 }}>{a.name}</span></td>
                    <td style={{ ...tdSt, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{a.quantity}</td>
                    <td style={{ ...tdSt, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{formatCRC(a.unitPrice)}</td>
                    <td style={{ ...tdSt, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: C.orange }}>{formatCRC(a.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div style={{ padding: '20px 28px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: C.black, borderRadius: 12, padding: '20px 24px', minWidth: 300, color: C.white }}>
            <Row label="Subtotal productos" val={formatCRC(quote.itemsSubtotal)} />
            {quote.acabadosSubtotal > 0 && <Row label="Subtotal acabados" val={formatCRC(quote.acabadosSubtotal)} color={C.orange} />}
            <div style={{ borderTop: '1px solid #333', margin: '8px 0' }} />
            <Row label="SUBTOTAL" val={formatCRC(quote.subtotal)} bold />
            {quote.discountAmount > 0 && <Row label={`Descuento${quote.discountType === 'percent' ? ` (${quote.discount}%)` : ''}`} val={`-${formatCRC(quote.discountAmount)}`} color={C.red} />}
            <Row label={`IVA (${quote.ivaRate}%)`} val={formatCRC(quote.ivaAmount)} />
            <div style={{ borderTop: '2px solid #444', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 16 }}>TOTAL</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 24, fontWeight: 800, color: C.yellow }}>{formatCRC(quote.total)}</span>
            </div>
          </div>
        </div>

        {quote.notes && (
          <div style={{ padding: '0 28px 24px' }}>
            <div style={{ background: '#f5f5f5', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#999', marginBottom: 6 }}>Notas y condiciones</div>
              <div style={{ fontSize: 13, color: '#444', whiteSpace: 'pre-line' }}>{quote.notes}</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ background: C.black, padding: '12px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#555', fontSize: 11 }}>COTIPLUS — {coInfo.companyName}</span>
          <span style={{ color: C.orange, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}>{quote.number}</span>
        </div>
      </div>
    </div>
  )
}

function Row({ label, val, color, bold }: { label: string; val: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
      <span style={{ color: bold ? C.white : '#aaa', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: color || (bold ? C.white : '#ddd'), fontWeight: bold ? 700 : 400 }}>{val}</span>
    </div>
  )
}
