# AI Lab Notebook

> An interactive, AI-guided data science notebook that runs Python in the browser (Pyodide) and streams answers from Claude or a local Qwen/Ollama model.

---

## Features

| Cell type | What it does |
|-----------|--------------|
| **Code** | Run Python (pandas, numpy, scipy, matplotlib, Plotly) in-browser via Pyodide |
| **Markdown** | Rich text with math notation, edit ↔ preview toggle |
| **AI Assistant** | Chat with Claude or local Qwen; one-click "Insert as code cell" |
| **Data Upload** | Upload CSV/TSV → loads into Python namespace as a pandas DataFrame |
| **Model** | Browse pre-built models (Luedeking-Piret, Logistic, Gompertz) with explanations + starter code |

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/your-handle/ai-lab-notebook.git
cd ai-lab-notebook
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Fill in ANTHROPIC_API_KEY (required for Claude)
# Optionally set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
# For local Qwen: set NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
```

### 3. Run locally

```bash
npm run dev
# → http://localhost:3000
```

---

## AI Providers

### Claude (default)
Set `ANTHROPIC_API_KEY` in `.env.local`. Requests go through the `/api/ai` Edge Function — your key stays server-side.

### Local Qwen / Ollama
Run Ollama with a model (e.g. `ollama run qwen2.5-coder:14b`), then set:
```
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
NEXT_PUBLIC_OLLAMA_MODEL=qwen2.5-coder:14b
```
The app will call Ollama directly from the browser — no server needed.

---

## Supabase Persistence (optional)

1. Create a Supabase project
2. Run the following SQL in the SQL editor:

```sql
create table notebooks (
  id          text primary key,
  name        text not null,
  description text default '',
  cells_json  text default '[]',
  user_id     text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
```

3. Copy your project URL and anon key into `.env.local`

---

## Deployment (Vercel)

```bash
npm run build   # verify no errors
vercel deploy   # or push to GitHub and import on vercel.com
```

Set environment variables in **Vercel → Project → Settings → Environment Variables**.  
`ANTHROPIC_API_KEY` must be a **server-side** variable (do not prefix with `NEXT_PUBLIC_`).

---

## Python Environment

Pyodide v0.26.2 is loaded from CDN on first use. Pre-installed packages:
- `pandas`, `numpy`, `scipy`, `matplotlib`
- Any extra package can be installed per-cell: `import micropip; await micropip.install('scikit-learn')`

Plots are captured automatically:
- **Matplotlib** → base64 PNG
- **Plotly** → JSON (assign your figure to `__fig__`)

```python
# Matplotlib example
import matplotlib.pyplot as plt
fig, ax = plt.subplots()
ax.plot([1, 2, 3], [4, 5, 6])
plt.show()   # captured automatically

# Plotly example
import plotly.graph_objects as go
fig = go.Figure(go.Scatter(x=[1, 2, 3], y=[4, 5, 6]))
__fig__ = fig   # renders inline
```

---

## Project Structure

```
app/
  page.tsx                  Home — starter notebook cards
  notebook/[id]/page.tsx    Notebook page
  api/ai/route.ts           Claude Edge API (SSE)
  globals.css

components/notebook/
  Notebook.tsx              State machine (useReducer)
  AddCellMenu.tsx
  cells/
    CodeCell.tsx
    MarkdownCell.tsx
    AICell.tsx
    DataCell.tsx
    ModelCell.tsx

lib/
  pyodide-manager.ts        Pyodide singleton + runCell()
  ai.ts                     streamAI() — Claude or Ollama
  supabase.ts               Save / load notebooks
  models/templates.ts       Pre-built model definitions

types/notebook.ts
```

---

## Roadmap

- [ ] Authentication (Supabase Auth)
- [ ] Notebook list / management page
- [ ] Export to `.ipynb`
- [ ] More models: Monod kinetics, Weibull inactivation, Arrhenius temperature
- [ ] Collaborative editing
- [ ] Raspberry Pi / local server mode

---

## License

MIT
