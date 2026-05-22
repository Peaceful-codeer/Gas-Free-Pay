import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'
import api from '../utils/api'
import { useWallet } from '../hooks/useWallet.jsx'

// Fill in every day for the last 30 days, zero for days with no sales
function buildFullTimeline(sparse) {
  const map = {}
  sparse.forEach(d => {
    const key = new Date(d.date).toISOString().slice(0, 10)
    map[key] = d.revenue
  })
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({
      date: key,
      label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      revenue: map[key] ?? 0
    })
  }
  return days
}

// Custom tooltip shown on hover
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 14px',
      fontFamily: 'var(--font-mono)', fontSize: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'var(--accent2)', fontWeight: 700, fontSize: 15 }}>
        ${payload[0].value.toFixed(4)}
      </div>
    </div>
  )
}

export default function MerchantDashboard() {
  const { address } = useWallet()
  const [data, setData] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    if (!address) { setLoading(false); return }
    Promise.all([
      api.get('/merchants/me/analytics'),
      api.get('/merchants/me/products')
    ]).then(([a, p]) => {
      setData(a.data)
      setProducts(p.data)
      setChartData(buildFullTimeline(a.data?.daily || []))
    }).catch(console.error).finally(() => setLoading(false))
  }, [address])

  if (!address) return (
    <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
      Sign in to access the creator dashboard.
    </div>
  )

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[1,2,3,4].map(i => <div key={i} className="card skeleton" style={{ height: 80 }} />)}
      </div>
      <div className="card skeleton" style={{ height: 220 }} />
    </div>
  )

  const totalRevenue = parseFloat(data?.total_revenue || 0)
  const maxDay = Math.max(...chartData.map(d => d.revenue), 0)
  // Show only every 5th label so X-axis doesn't crowd
  const tickInterval = Math.floor(chartData.length / 6)

  const stats = [
    { label: 'Total Revenue',  value: `$${data?.total_revenue || '0.00'}`, color: 'var(--accent2)' },
    { label: 'History',        value: data?.tx_count || 0,                 color: 'var(--accent)' },
    { label: 'Checkout Items', value: products.length,                     color: 'var(--gold)' },
    { label: 'Pending Payout', value: `$${data?.pending_payout || '0.00'}`,color: 'var(--success)' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>Merchant Dashboard</h2>
        <Link to="/merchant/products/new" className="btn btn-primary">+ New Item</Link>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 500, color: s.color, marginBottom: 4 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Revenue — Last 30 days
            </h3>
            {maxDay > 0 && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Peak day: <span style={{ color: 'var(--accent2)' }}>${maxDay.toFixed(4)}</span>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: 'var(--accent2)' }}>
              ${totalRevenue.toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>30-day total</div>
          </div>
        </div>

        {chartData.every(d => d.revenue === 0) ? (
          /* Empty state — no data yet */
          <div style={{
            height: 180, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--muted)', fontSize: 13,
            border: '1px dashed var(--border)', borderRadius: 10
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📈</div>
            <div>Revenue will appear here after your first sale</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                {/* Gradient fill under the area */}
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#2dd4bf" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0.01} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />

              <XAxis
                dataKey="label"
                tick={{ fill: '#6b6b80', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={tickInterval}
              />

              <YAxis
                tick={{ fill: '#6b6b80', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={42}
                tickFormatter={v => v === 0 ? '0' : `$${v.toFixed(2)}`}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(45,212,191,0.2)', strokeWidth: 1 }} />

              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#2dd4bf"
                strokeWidth={2}
                fill="url(#revenueGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#2dd4bf', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Products list */}
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Checkout Items
        </h3>
        {products.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            No items yet.{' '}
            <Link to="/merchant/products/new" style={{ color: 'var(--accent)' }}>Create your first</Link>
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {products.map(p => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0', borderBottom: '1px solid var(--border)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <span className={`tag ${p.type === 'subscription' ? 'tag-yellow' : 'tag-green'}`} style={{ marginTop: 4 }}>
                    {p.type}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent2)' }}>${p.price_usd}</span>
                  <Link to={`/pay/${p.id}`} className="btn btn-outline" style={{ padding: '5px 12px', fontSize: 12 }}>
                    Checkout link
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}