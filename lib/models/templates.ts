import type { ModelTemplate } from '@/types/notebook'

export const MODEL_TEMPLATES: ModelTemplate[] = [
  // ─── Luedeking-Piret ──────────────────────────────────────────────────────
  {
    id: 'luedeking-piret',
    name: 'Luedeking-Piret',
    category: 'Fermentation',
    description: 'Models lactic acid production as a function of bacterial growth — ideal for cheese acidification.',
    explanation: `## Luedeking-Piret Model

### What it does
Describes the rate of acid (or product) formation during fermentation as the sum of two contributions:

$$\\frac{dA}{dt} = \\alpha \\cdot \\frac{dX}{dt} + \\beta \\cdot X$$

| Symbol | Name | Physical meaning |
|--------|------|-----------------|
| **A(t)** | Acid proxy | pH₀ − pH(t) — total acid produced |
| **X(t)** | Biomass | Bacterial population (modelled as logistic) |
| **α** | Growth-associated coefficient | Acid produced *during* active cell division |
| **β** | Non-growth-associated coefficient | Acid produced by resting cells (maintenance metabolism) |

### When to use it
✅ Cheese/yogurt fermentation with mesophilic/thermophilic starters
✅ You have a continuous pH trace and want to separate growth vs. maintenance effects
⚠️ Needs a smooth pH curve (apply Savitzky-Golay before fitting)
❌ Not appropriate for multi-stage fermentations with lag phases

### Interpreting results
- **α >> β** → acidification is dominated by active growth phase
- **β >> α** → acidification continues long after growth stopped (stationary phase dominant)
- **R² > 0.8** → good fit; **R² < 0.5** → consider a different model`,

    parameters: [
      { symbol: 'α', name: 'Growth-associated coefficient', unit: 'ΔpH/biomass', description: 'Acid produced per unit of new biomass formed' },
      { symbol: 'β', name: 'Non-growth-associated coefficient', unit: 'ΔpH/(biomass·h)', description: 'Acid produced per unit biomass per hour (maintenance)' },
    ],

    code: `# ── Luedeking-Piret model ─────────────────────────────────────────────────
# Replace 'df' with your DataFrame variable and 'pH' with your pH column
import numpy as np
import pandas as pd
from scipy.optimize import curve_fit
import matplotlib.pyplot as plt

# ① Load & clean your data
# df = pd.read_csv('your_file.csv', index_col='datetime', parse_dates=True)
# ph = df['pH'].dropna()

# --- demo with synthetic data (replace with your real series) ---
t_demo = np.linspace(0, 5, 300)
ph = pd.Series(
    5.0 + 1.5 * np.exp(-0.8 * t_demo) + 0.05 * np.random.randn(300),
    index=t_demo, name='pH'
)
t = ph.index.to_numpy().astype(float)

# ② Compute acid proxy and its derivative
A    = ph.values[0] - ph.values          # ΔpH = acid proxy
dAdt = np.gradient(A, t)

# ③ Fit logistic growth X(t)
def logistic(t, k, t0):
    return 1 / (1 + np.exp(-k * (t - t0)))

t0_est   = t[np.argmin(np.gradient(ph.values, t))]
popt, _  = curve_fit(logistic, t, A / A.max(), p0=[2.0, t0_est], maxfev=5000)
X        = logistic(t, *popt)
dXdt     = popt[0] * X * (1 - X)        # analytical derivative

# ④ Fit Luedeking-Piret (linear regression)
design        = np.column_stack([dXdt, X])
(alpha, beta) = np.linalg.lstsq(design, dAdt, rcond=None)[0]
dAdt_pred     = alpha * dXdt + beta * X
r2 = 1 - np.sum((dAdt - dAdt_pred)**2) / np.sum((dAdt - dAdt.mean())**2)

print(f"α (growth-associated)      = {alpha:.4f}")
print(f"β (non-growth-associated)  = {beta:.4f}")
print(f"α/β ratio                  = {alpha/beta:.2f}")
print(f"Dominant phase             : {'growth' if alpha > beta else 'stationary'}")
print(f"R²                         = {r2:.3f}")

# ⑤ Plot
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

ax1.plot(t, ph.values, 'steelblue', lw=2, label='pH')
ax1.set_xlabel('Time (h)'); ax1.set_ylabel('pH')
ax1.set_title('Acidification curve'); ax1.legend()

ax2.plot(t, dAdt, color='lightgray', lw=1.2, label='dA/dt measured')
ax2.plot(t, dAdt_pred, 'tomato', lw=2.2, ls='--',
         label=f'LP fit  R²={r2:.3f}')
ax2.set_xlabel('Time (h)'); ax2.set_ylabel('Acidification rate (ΔpH/h)')
ax2.set_title('Luedeking-Piret fit'); ax2.legend()
plt.tight_layout()
`,
  },

  // ─── Logistic decline ─────────────────────────────────────────────────────
  {
    id: 'logistic-decline',
    name: 'Logistic pH decline',
    category: 'Fermentation',
    description: 'Sigmoidal model for pH decrease — fits the characteristic S-curve of fermentation.',
    explanation: `## Logistic pH Decline

### What it does
Models the pH curve as a **sigmoidal (S-shaped) decline**:

$$\\text{pH}(t) = pH_{\\infty} + \\frac{pH_0 - pH_{\\infty}}{1 + e^{k(t - t_{1/2})}}$$

| Symbol | Meaning |
|--------|---------|
| **pH₀** | Initial pH |
| **pH∞** | Final (plateau) pH |
| **k** | Steepness of decline (1/h) |
| **t½** | Time of maximum acidification rate |

### When to use it
✅ Single-stage fermentation with a clear sigmoidal pH profile
✅ You want to predict the time to reach a target pH
⚠️ Assumes one dominant acidification phase
❌ Not good for multi-stage or interrupted fermentations`,

    parameters: [
      { symbol: 'pH₀', name: 'Initial pH', unit: '—', description: 'pH at the start of fermentation' },
      { symbol: 'pH∞', name: 'Final pH', unit: '—', description: 'Plateau pH (minimum)' },
      { symbol: 'k', name: 'Rate constant', unit: '1/h', description: 'Steepness of the decline' },
      { symbol: 't½', name: 'Half-time', unit: 'h', description: 'Time of maximum rate' },
    ],

    code: `# ── Logistic pH decline ───────────────────────────────────────────────────
import numpy as np
import pandas as pd
from scipy.optimize import curve_fit
import matplotlib.pyplot as plt

# ① Your data (replace with real series)
t_demo = np.linspace(0, 6, 360)
ph_data = 4.8 + 1.4 / (1 + np.exp(2.5 * (t_demo - 2.5))) + 0.03*np.random.randn(360)
ph = pd.Series(ph_data, index=t_demo)
t  = ph.index.to_numpy().astype(float)

# ② Define model
def logistic_decline(t, pH_inf, pH0, k, t_half):
    return pH_inf + (pH0 - pH_inf) / (1 + np.exp(k * (t - t_half)))

# ③ Fit
p0   = [ph.min(), ph.max(), 2.0, t[np.argmin(np.gradient(ph.values, t))]]
popt, pcov = curve_fit(logistic_decline, t, ph.values, p0=p0, maxfev=10000)
pH_inf, pH0, k, t_half = popt
perr = np.sqrt(np.diag(pcov))

ph_fit = logistic_decline(t, *popt)
r2 = 1 - np.sum((ph.values - ph_fit)**2) / np.sum((ph.values - ph.mean())**2)

print(f"pH₀    = {pH0:.3f}  ±{perr[1]:.3f}")
print(f"pH∞    = {pH_inf:.3f}  ±{perr[0]:.3f}")
print(f"k      = {k:.3f}  ±{perr[2]:.3f} 1/h")
print(f"t½     = {t_half:.3f}  ±{perr[3]:.3f} h")
print(f"R²     = {r2:.4f}")

# Predict time to reach pH 5.0
t_target = t_half + np.log((pH0 - 5.0) / (5.0 - pH_inf)) / k
print(f"\\nPredicted time to pH 5.0 : {t_target:.2f} h")

# ④ Plot
fig, ax = plt.subplots(figsize=(12, 5))
ax.scatter(t[::5], ph.values[::5], color='steelblue', s=15, alpha=0.5, label='Data')
ax.plot(t, ph_fit, 'tomato', lw=2.5, label=f'Logistic fit  R²={r2:.3f}')
ax.axhline(5.0, color='gray', ls=':', lw=1, label='Target pH 5.0')
ax.axvline(t_target, color='green', ls='--', lw=1.2, label=f't(pH=5) = {t_target:.2f} h')
ax.set_xlabel('Time (h)'); ax.set_ylabel('pH')
ax.set_title('Logistic pH decline fit'); ax.legend()
plt.tight_layout()
`,
  },

  // ─── Gompertz ─────────────────────────────────────────────────────────────
  {
    id: 'gompertz',
    name: 'Modified Gompertz',
    category: 'Microbial growth',
    description: 'Asymmetric sigmoidal growth model — captures lag phase, exponential growth, and stationary phase.',
    explanation: `## Modified Gompertz Model

### What it does
Models **microbial growth** (or acid production) with three phases:

$$N(t) = N_{\\max} \\cdot \\exp\\left(-\\exp\\left(\\frac{\\mu_{\\max} \\cdot e}{N_{\\max}}(\\lambda - t) + 1\\right)\\right)$$

| Symbol | Meaning |
|--------|---------|
| **N_max** | Maximum growth (or acid) |
| **μ_max** | Maximum specific growth rate |
| **λ** | Lag phase duration |

### When to use it
✅ Bacterial growth curves with a visible lag phase
✅ Predictive microbiology (food safety modelling)
⚠️ Asymmetric: slower at the end than the start`,

    parameters: [
      { symbol: 'N_max', name: 'Asymptote', unit: 'log CFU/ml', description: 'Maximum population density' },
      { symbol: 'μ_max', name: 'Max growth rate', unit: '1/h', description: 'Maximum specific growth rate' },
      { symbol: 'λ', name: 'Lag time', unit: 'h', description: 'Duration of the lag phase' },
    ],

    code: `# ── Modified Gompertz growth model ────────────────────────────────────────
import numpy as np
from scipy.optimize import curve_fit
import matplotlib.pyplot as plt

t = np.linspace(0, 24, 200)

def gompertz(t, N_max, mu_max, lag):
    return N_max * np.exp(-np.exp((mu_max * np.e / N_max) * (lag - t) + 1))

# Synthetic data — replace with your measurements
y_true = gompertz(t, N_max=8.0, mu_max=0.5, lag=3.0) + 0.1*np.random.randn(200)
y_true = np.clip(y_true, 0, None)

p0   = [y_true.max(), 0.5, 2.0]
popt, pcov = curve_fit(gompertz, t, y_true, p0=p0, maxfev=10000,
                       bounds=([0, 0, 0], [20, 5, 24]))
N_max, mu_max, lag = popt
perr = np.sqrt(np.diag(pcov))

y_fit = gompertz(t, *popt)
r2 = 1 - np.sum((y_true - y_fit)**2) / np.sum((y_true - y_true.mean())**2)

print(f"N_max  = {N_max:.3f}  ±{perr[0]:.3f}")
print(f"μ_max  = {mu_max:.4f}  ±{perr[1]:.4f} 1/h")
print(f"λ      = {lag:.3f}  ±{perr[2]:.3f} h")
print(f"R²     = {r2:.4f}")

fig, ax = plt.subplots(figsize=(12, 5))
ax.scatter(t[::5], y_true[::5], s=20, alpha=0.5, label='Data')
ax.plot(t, y_fit, 'tomato', lw=2.5, label=f'Gompertz  R²={r2:.3f}')
ax.axvline(lag, ls='--', color='gray', label=f'Lag λ = {lag:.2f} h')
ax.set_xlabel('Time (h)'); ax.set_ylabel('log N')
ax.set_title('Modified Gompertz growth curve'); ax.legend()
plt.tight_layout()
`,
  },
]

export function getTemplate(id: string): ModelTemplate | undefined {
  return MODEL_TEMPLATES.find(t => t.id === id)
}
