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
  // Built-in Pyodide packages (compiled for WASM)
  await _pyodide.loadPackage([
    'pandas', 'numpy', 'scipy', 'matplotlib',
    'scikit-learn', 'statsmodels', 'sympy', 'micropip',
  ])

  // Pure-Python packages via micropip (seaborn depends on matplotlib already loaded)
  await _pyodide.runPythonAsync(`
import micropip
await micropip.install('seaborn')
`)

  // Install harness
  await _pyodide.runPythonAsync(HARNESS)

  _waiters.forEach(cb => cb(_pyodide))
  _waiters.length = 0
  _loading = false

  return _pyodide
}

export async function runCell(code: string): Promise<CellOutput> {
  // If Jupyter URL is configured, use the remote kernel instead of Pyodide
  if (process.env.NEXT_PUBLIC_JUPYTER_URL?.trim()) {
    const { getJupyterKernel } = await import('@/lib/jupyter-kernel')
    const kernel = await getJupyterKernel()
    return kernel.runCell(code)
  }

  // Pyodide (browser-local) path
  const t0  = Date.now()
  const py  = await getPyodide()

  const escaped = code.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')
  const raw = await py.runPythonAsync(`_run_cell("""${escaped}""")`)

  const result = JSON.parse(raw) as Omit<CellOutput, 'elapsed'>
  return { ...result, elapsed: Date.now() - t0 }
}

/** Load a CSV/TSV file into Python and inject it into the shared notebook namespace. */
export async function loadFileIntoPython(
  variableName: string,
  csvContent: string
): Promise<string> {
  const py = await getPyodide()
  py.globals.set('__csv_raw__', csvContent)

  // sep=None + engine='python' → pandas auto-detects , ; \t etc.
  const result = await py.runPythonAsync(`
import pandas as _pd, io as _io, json as _json

try:
    __df_tmp__ = _pd.read_csv(_io.StringIO(__csv_raw__), sep=None, engine='python')
    _nb_globals['${variableName}'] = __df_tmp__
    __out__ = _json.dumps({
        'ok': True,
        'rows': len(__df_tmp__),
        'cols': list(__df_tmp__.columns),
        'sep':  str(__df_tmp__.columns[0]),   # first col name as hint
    })
    del __df_tmp__
except Exception as _e:
    __out__ = _json.dumps({'ok': False, 'error': str(_e)})

del __csv_raw__
__out__
`)

  py.globals.delete('__csv_raw__')
  return result
}
