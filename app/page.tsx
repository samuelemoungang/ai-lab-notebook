'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { FlaskConical, Plus, BookOpen, Cpu, BarChart2, Trash2 } from 'lucide-react'
import type { Notebook, Cell, CellType } from '@/types/notebook'
import { listNotebooks, deleteNotebook, createNotebook, saveNotebook, importNotebookFromFile, toIpynb } from '@/lib/storage'

function makeCell(type: CellType, content: string): Cell {
  return { id: crypto.randomUUID(), type, content, output: null, running: false, metadata: {} }
}

// ── Template cells ───────────────────────────────────────────────────────────
const TEMPLATE_CELLS: Record<string, Cell[]> = {
  'Cheese Acidification': [
    makeCell('markdown', `# Cheese Acidification Analysis

**Pipeline:** upload pH/temperature CSV → Nernst correction → Luedeking-Piret model

Steps:
1. **Data** cell — upload your fermentation CSV (columns: \`time\`, \`pH\`, \`temperature\`)
2. **Nernst** cell — correct pH to a reference temperature of 25 °C
3. **Luedeking-Piret** cell — fit the acidification model and extract α and β
4. **AI** cell — get an interpretation of the fitted parameters`),

    makeCell('data', ''),

    makeCell('code', `# ── Nernst temperature correction ────────────────────────────────────────────
# Requires: df with columns 'time' (h), 'pH', 'temperature' (°C)
import numpy as np
import matplotlib.pyplot as plt

R, F   = 8.314, 96485
T_ref  = 298.15   # 25 °C in Kelvin

df['T_K']   = df['temperature'] + 273.15
df['pH_25'] = df['pH'] + (df['T_K'] - T_ref) * (R * np.log(10) / F)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
ax1.plot(df['time'], df['pH'],    label='Raw pH',    color='steelblue')
ax1.plot(df['time'], df['pH_25'], label='pH @ 25 °C', color='tomato', ls='--')
ax1.set(xlabel='Time (h)', ylabel='pH', title='Nernst correction'); ax1.legend()

ax2.plot(df['time'], df['temperature'], color='orange')
ax2.set(xlabel='Time (h)', ylabel='Temperature (°C)', title='Temperature profile')
plt.tight_layout()
print(f"Max ΔpH from correction: {(df['pH_25'] - df['pH']).abs().max():.4f}")`),

    makeCell('code', `# ── Luedeking-Piret fit ──────────────────────────────────────────────────────
from scipy.optimize import curve_fit

t  = df['time'].to_numpy().astype(float)
ph = df['pH_25'].to_numpy()

A    = ph[0] - ph
dAdt = np.gradient(A, t)

def logistic(t, k, t0):
    return 1 / (1 + np.exp(-k * (t - t0)))

t0_est  = t[np.argmin(np.gradient(ph, t))]
popt, _ = curve_fit(logistic, t, A / (A.max() or 1), p0=[2.0, t0_est], maxfev=5000)
X       = logistic(t, *popt)
dXdt    = popt[0] * X * (1 - X)

design        = np.column_stack([dXdt, X])
(alpha, beta) = np.linalg.lstsq(design, dAdt, rcond=None)[0]
dAdt_pred     = alpha * dXdt + beta * X
r2 = 1 - np.sum((dAdt - dAdt_pred)**2) / np.sum((dAdt - dAdt.mean())**2)

print(f"α (growth-associated)     = {alpha:.4f}")
print(f"β (non-growth-associated) = {beta:.4f}")
print(f"α/β ratio                 = {alpha/beta:.2f}")
print(f"Dominant phase            : {'growth' if alpha > beta else 'stationary'}")
print(f"R²                        = {r2:.3f}")

fig, ax = plt.subplots(figsize=(12, 5))
ax.plot(t, dAdt,      color='lightgray', lw=1.2, label='dA/dt measured')
ax.plot(t, dAdt_pred, 'tomato', lw=2.2, ls='--', label=f'LP fit  R²={r2:.3f}')
ax.set(xlabel='Time (h)', ylabel='Acidification rate (ΔpH/h)', title='Luedeking-Piret fit')
ax.legend(); plt.tight_layout()`),

    makeCell('ai', 'Interpret the Luedeking-Piret results: what do the α and β values tell us about this fermentation? Is acidification dominated by active growth or by maintenance metabolism? Is the R² acceptable?'),
  ],

  'Blank Notebook': [
    makeCell('code', ''),
  ],

  'Numerical Methods': [
    makeCell('markdown', `# Numerical Methods

Three ready-to-run examples:
1. **ODE** — solve a system of differential equations with \`scipy.integrate.solve_ivp\`
2. **Curve fitting** — non-linear least squares with \`scipy.optimize.curve_fit\`
3. **Interpolation** — compare linear, cubic, and PCHIP interpolation`),

    makeCell('code', `# ── ODE: SIR epidemic model ──────────────────────────────────────────────────
import numpy as np
from scipy.integrate import solve_ivp
import matplotlib.pyplot as plt

N     = 1000    # total population
beta  = 0.3     # transmission rate
gamma = 0.05    # recovery rate

def sir(t, y):
    S, I, R = y
    dS = -beta * S * I / N
    dI =  beta * S * I / N - gamma * I
    dR =  gamma * I
    return [dS, dI, dR]

sol = solve_ivp(sir, [0, 160], [999, 1, 0], dense_output=True, max_step=0.5)
t   = np.linspace(0, 160, 500)
S, I, R = sol.sol(t)

fig, ax = plt.subplots(figsize=(12, 5))
ax.plot(t, S, label='Susceptible', color='steelblue')
ax.plot(t, I, label='Infected',    color='tomato')
ax.plot(t, R, label='Recovered',   color='seagreen')
ax.set(xlabel='Days', ylabel='People', title='SIR epidemic model')
ax.legend(); plt.tight_layout()
print(f"Peak infections: {I.max():.0f} on day {t[I.argmax()]:.1f}")`),

    makeCell('code', `# ── Curve fitting: exponential decay ─────────────────────────────────────────
from scipy.optimize import curve_fit

t_data = np.linspace(0, 5, 60)
y_data = 3.5 * np.exp(-0.8 * t_data) + 0.15 * np.random.randn(60)

def model(t, A, k):
    return A * np.exp(-k * t)

popt, pcov = curve_fit(model, t_data, y_data, p0=[3, 1])
A, k = popt
perr = np.sqrt(np.diag(pcov))

y_fit = model(t_data, *popt)
r2    = 1 - np.sum((y_data - y_fit)**2) / np.sum((y_data - y_data.mean())**2)

print(f"A = {A:.4f} ± {perr[0]:.4f}")
print(f"k = {k:.4f} ± {perr[1]:.4f}  (half-life = {np.log(2)/k:.2f})")
print(f"R² = {r2:.4f}")

fig, ax = plt.subplots(figsize=(12, 5))
ax.scatter(t_data, y_data, s=20, alpha=0.6, label='Data')
ax.plot(t_data, y_fit, 'tomato', lw=2, label=f'Fit  R²={r2:.4f}')
ax.set(xlabel='t', ylabel='y', title='Exponential decay — curve fit')
ax.legend(); plt.tight_layout()`),

    makeCell('code', `# ── Interpolation comparison ─────────────────────────────────────────────────
from scipy.interpolate import interp1d, PchipInterpolator

x_sparse = np.linspace(0, 2 * np.pi, 10)
y_sparse = np.sin(x_sparse)
x_dense  = np.linspace(0, 2 * np.pi, 300)

lin   = interp1d(x_sparse, y_sparse, kind='linear')(x_dense)
cubic = interp1d(x_sparse, y_sparse, kind='cubic')(x_dense)
pchip = PchipInterpolator(x_sparse, y_sparse)(x_dense)

fig, ax = plt.subplots(figsize=(12, 5))
ax.scatter(x_sparse, y_sparse, zorder=5, label='Sparse data', color='black', s=40)
ax.plot(x_dense, np.sin(x_dense), 'gray',    lw=1.5, ls=':', label='True sin(x)')
ax.plot(x_dense, lin,             'steelblue', lw=1.5, label='Linear')
ax.plot(x_dense, cubic,           'tomato',    lw=1.5, label='Cubic spline')
ax.plot(x_dense, pchip,           'seagreen',  lw=1.5, ls='--', label='PCHIP')
ax.set(xlabel='x', ylabel='y', title='Interpolation comparison')
ax.legend(); plt.tight_layout()`),
  ],

  'Data Exploration': [
    makeCell('markdown', `# Data Exploration

**Workflow:**
1. Upload your CSV in the **Data** cell below
2. Run the **statistics** cell — shape, dtypes, missing values, describe
3. Run the **distributions** cell — histograms for each numeric column
4. Run the **correlations** cell — heatmap + pairplot`),

    makeCell('data', ''),

    makeCell('code', `# ── Dataset overview ─────────────────────────────────────────────────────────
# Requires: df loaded via the Data cell
import pandas as pd
import numpy as np

print("Shape:", df.shape)
print()
print("Dtypes:")
print(df.dtypes.to_string())
print()
print("Missing values:")
missing = df.isnull().sum()
print(missing[missing > 0].to_string() if missing.any() else "  none")
print()
print(df.describe().round(3).to_string())`),

    makeCell('code', `# ── Distributions ────────────────────────────────────────────────────────────
import matplotlib.pyplot as plt

num_cols = df.select_dtypes(include='number').columns.tolist()
n = len(num_cols)
cols_per_row = min(3, n)
rows = (n + cols_per_row - 1) // cols_per_row

fig, axes = plt.subplots(rows, cols_per_row, figsize=(5 * cols_per_row, 4 * rows), squeeze=False)
for i, col in enumerate(num_cols):
    ax = axes[i // cols_per_row][i % cols_per_row]
    df[col].dropna().plot.hist(ax=ax, bins=30, color='steelblue', edgecolor='none', alpha=0.8)
    ax.set(title=col, xlabel='', ylabel='Count')

for j in range(len(num_cols), rows * cols_per_row):
    axes[j // cols_per_row][j % cols_per_row].set_visible(False)

plt.tight_layout()`),

    makeCell('code', `# ── Correlations ─────────────────────────────────────────────────────────────
import seaborn as sns
import matplotlib.pyplot as plt

corr = df.select_dtypes(include='number').corr()

fig, ax = plt.subplots(figsize=(max(6, len(corr)), max(5, len(corr) - 1)))
sns.heatmap(
    corr, annot=True, fmt='.2f', cmap='coolwarm', center=0,
    square=True, linewidths=0.5, ax=ax, cbar_kws={'shrink': 0.8}
)
ax.set_title('Correlation matrix'); plt.tight_layout()

# Top 5 strongest correlations (excluding self-correlations)
pairs = (corr.abs()
         .where(np.triu(np.ones(corr.shape), k=1).astype(bool))
         .stack()
         .sort_values(ascending=False))
print("Top correlations:")
print(pairs.head(5).to_string())`),

    makeCell('ai', 'Look at the dataset statistics and correlation matrix. Which variables are most strongly correlated? Are there any surprising relationships or potential outliers I should investigate?'),
  ],
}

// ── Starter templates ────────────────────────────────────────────────────────
const TEMPLATES: Array<{ name: string; description: string; icon: React.ReactNode }> = [
  {
    name:        'Cheese Acidification',
    description: 'pH/temperature CSV, Nernst correction, Luedeking-Piret model.',
    icon:        <FlaskConical size={18} className="text-accent-model" />,
  },
  {
    name:        'Numerical Methods',
    description: 'ODE solving, curve fitting, interpolation.',
    icon:        <Cpu size={18} className="text-accent-ai" />,
  },
  {
    name:        'Data Exploration',
    description: 'Upload a CSV, explore distributions and correlations.',
    icon:        <BarChart2 size={18} className="text-accent-data" />,
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m    = Math.floor(diff / 60_000)
  const h    = Math.floor(diff / 3_600_000)
  const d    = Math.floor(diff / 86_400_000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router    = useRouter()
  const importRef = useRef<HTMLInputElement>(null)
  const [notebooks,    setNotebooks]    = useState<Notebook[]>([])
  const [importError,  setImportError]  = useState<string | null>(null)

  useEffect(() => {
    setNotebooks(listNotebooks())
  }, [])

  function openNew(name?: string) {
    const cells = name ? (TEMPLATE_CELLS[name] ?? []) : []
    const nb    = createNotebook(name, cells)
    saveNotebook(nb)
    router.push(`/notebook/${nb.id}`)
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Delete this notebook?')) return
    deleteNotebook(id)
    setNotebooks(prev => prev.filter(n => n.id !== id))
  }

  function handleDownload(e: React.MouseEvent, nb: Notebook) {
    e.stopPropagation()
    const slug = nb.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'notebook'
    const blob = new Blob([toIpynb(nb)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: `${slug}.ipynb` }).click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    try {
      const text = await file.text()
      const nb   = importNotebookFromFile(file.name, text)
      saveNotebook(nb)
      router.push(`/notebook/${nb.id}`)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-notebook-bg text-notebook-text">
      {/* Header */}
      <header className="border-b border-notebook-border px-6 py-4 flex items-center gap-3">
        <FlaskConical size={22} className="text-accent-model" />
        <h1 className="text-base font-semibold">AI Lab Notebook</h1>

        {/* Import button */}
        <button
          onClick={() => importRef.current?.click()}
          className="ml-auto text-xs border border-notebook-border rounded px-3 py-1.5 text-notebook-muted hover:text-notebook-text hover:border-notebook-border/80 transition-colors"
        >
          Import .json / .ipynb
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json,.ipynb"
          className="hidden"
          onChange={handleImport}
        />

        <span className="text-xs text-notebook-muted">Python · Qwen · Pyodide</span>
      </header>

      {/* Import error */}
      {importError && (
        <div className="max-w-4xl mx-auto px-6 pt-4">
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            ⚠ {importError}
          </p>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">

        {/* ── Saved notebooks ── */}
        {notebooks.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-notebook-muted uppercase tracking-wider mb-3">
              Your notebooks
            </h2>
            <div className="space-y-2">
              {notebooks.map(nb => (
                <div
                  key={nb.id}
                  onClick={() => router.push(`/notebook/${nb.id}`)}
                  className="
                    group flex items-center gap-4 p-4 rounded-lg border border-notebook-border
                    bg-notebook-cell hover:border-accent-code/50 cursor-pointer transition-all
                  "
                >
                  <BookOpen size={16} className="text-notebook-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{nb.name}</p>
                    {nb.description && (
                      <p className="text-xs text-notebook-muted truncate">{nb.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-notebook-muted/60">
                      {nb.cells.length} {nb.cells.length === 1 ? 'cell' : 'cells'}
                    </span>
                    <span className="text-xs text-notebook-muted/60">
                      {relativeDate(nb.updatedAt)}
                    </span>
                    <button
                      onClick={e => handleDownload(e, nb)}
                      title="Download .json"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-notebook-muted hover:text-notebook-text transition-all text-xs"
                    >
                      ↓
                    </button>
                    <button
                      onClick={e => handleDelete(e, nb.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-notebook-muted hover:text-red-400 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── New notebook ── */}
        <section>
          <h2 className="text-sm font-semibold text-notebook-muted uppercase tracking-wider mb-3">
            New notebook
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Blank */}
            <button
              onClick={() => openNew()}
              className="
                flex items-center gap-3 p-4 rounded-lg border-2 border-dashed
                border-accent-code/40 hover:border-accent-code/80
                hover:bg-accent-code/5 transition-all text-left group
              "
            >
              <Plus size={18} className="text-accent-code" />
              <div>
                <p className="text-sm font-medium text-accent-code">New blank notebook</p>
                <p className="text-xs text-notebook-muted">Empty — start from scratch</p>
              </div>
            </button>

            {/* Templates */}
            {TEMPLATES.map(t => (
              <button
                key={t.name}
                onClick={() => openNew(t.name)}
                className="
                  flex items-center gap-3 p-4 rounded-lg border border-notebook-border
                  bg-notebook-cell hover:border-notebook-border/80
                  hover:bg-notebook-cell/60 transition-all text-left
                "
              >
                <span className="flex-shrink-0">{t.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-xs text-notebook-muted truncate">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Feature pills ── */}
        <div className="flex flex-wrap gap-2">
          {[
            '🐍 Python (Pyodide)',
            '🤖 Qwen (LM Studio)',
            '📊 Matplotlib · Plotly · Seaborn',
            '🔬 Luedeking-Piret',
            '📈 Gompertz · Logistic',
            '🧮 scikit-learn · statsmodels · sympy',
            '📁 CSV · TXT upload',
          ].map(f => (
            <span
              key={f}
              className="px-3 py-1 rounded-full border border-notebook-border text-xs text-notebook-muted"
            >
              {f}
            </span>
          ))}
        </div>
      </main>
    </div>
  )
}
