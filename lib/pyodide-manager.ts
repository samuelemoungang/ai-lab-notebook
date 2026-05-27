'use client'

import type { CellOutput } from '@/types/notebook'

// Pyodide loads globally from CDN — see app/layout.tsx <Script> tag
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadPyodide: (opts: Record<string, unknown>) => Promise<any>
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pyodide: any = null
let _loading  = false
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _waiters: Array<(p: any) => void> = []

// Shared Python execution harness installed once
const HARNESS = `
import sys, io, base64, json, traceback

_nb_globals: dict = {'__name__': '__main__'}

def _run_cell(code_str: str) -> str:
    """Execute code in the shared notebook namespace, capture output + plots."""
    _out = io.StringIO()
    _err = io.StringIO()
    _plots: list = []
    _error = None

    _old_out, _old_err = sys.stdout, sys.stderr
    sys.stdout, sys.stderr = _out, _err

    try:
        exec(compile(code_str, '<notebook>', 'exec'), _nb_globals)
    except Exception:
        _error = traceback.format_exc()
    finally:
        sys.stdout, sys.stderr = _old_out, _old_err

    # ── matplotlib ──────────────────────────────────────────────────────────
    try:
        import matplotlib.pyplot as _plt
        for _fn in _plt.get_fignums():
            _f = _plt.figure(_fn)
            _buf = io.BytesIO()
            _f.savefig(_buf, format='png', bbox_inches='tight', dpi=110)
            _buf.seek(0)
            _plots.append({'type': 'png',
                           'data': base64.b64encode(_buf.read()).decode()})
        _plt.close('all')
    except Exception:
        pass

    # ── plotly (user sets __fig__ = go.Figure(...)) ──────────────────────────
    if '__fig__' in _nb_globals:
        try:
            _plots.append({'type': 'plotly',
                           'data': _nb_globals['__fig__'].to_json()})
            del _nb_globals['__fig__']
        except Exception:
            pass

    return json.dumps({
        'stdout': _out.getvalue(),
        'stderr': _err.getvalue(),
        'plots':  _plots,
        'error':  _error,
    })
`

export async function getPyodide() {
  if (_pyodide) return _pyodide

  if (_loading) {
    return new Promise<typeof _pyodide>(resolve => _waiters.push(resolve))
  }

  _loading = true

  // Load CDN script if not already present
  if (!window.loadPyodide) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js'
      s.onload  = () => resolve()
      s.onerror = () => reject(new Error('Failed to load Pyodide CDN'))
      document.head.appendChild(s)
    })
  }

  _pyodide = await window.loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
  })

  // Install scientific stack (cached by Pyodide after first load)
  await _pyodide.loadPackage(['pandas', 'numpy', 'scipy', 'matplotlib'])

  // Install harness
  await _pyodide.runPythonAsync(HARNESS)

  _waiters.forEach(cb => cb(_pyodide))
  _waiters.length = 0
  _loading = false

  return _pyodide
}

export async function runCell(code: string): Promise<CellOutput> {
  const t0  = Date.now()
  const py  = await getPyodide()

  // Escape backticks in code to safely embed in Python string
  const escaped = code.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')

  const raw = await py.runPythonAsync(
    `_run_cell("""${escaped}""")`
  )

  const result = JSON.parse(raw) as Omit<CellOutput, 'elapsed'>
  return { ...result, elapsed: Date.now() - t0 }
}

/** Pass a CSV file content into Python as a string variable `__csv_content__`. */
export async function loadFileIntoPython(
  variableName: string,
  csvContent: string
) {
  const py = await getPyodide()
  py.globals.set('__csv_raw__', csvContent)
  await py.runPythonAsync(`
import pandas as _pd, io as _io
${variableName} = _pd.read_csv(_io.StringIO(__csv_raw__))
_nb_globals['${variableName}'] = ${variableName}
print(f"✓ Loaded '${variableName}' — {len(${variableName})} rows × {len(${variableName}.columns)} columns")
print(${variableName}.head(3).to_string())
`)
}
