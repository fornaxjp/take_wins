// Code Runner Service using WebAssembly
// Support for Python (Pyodide), SQL (sql.js), and R (webR)

let pyodide: any = null;

export const loadPyodide = async () => {
  if (pyodide) return pyodide;
  // @ts-ignore
  pyodide = await window.loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"
  });
  return pyodide;
};

export const runPython = async (code: string) => {
  const py = await loadPyodide();
  try {
    // Capture stdout
    py.runPython(`
import sys
import io
sys.stdout = io.String()
    `);
    await py.runPythonAsync(code);
    const stdout = py.runPython("sys.stdout.getvalue()");
    return { output: stdout, type: 'text' };
  } catch (err: any) {
    return { output: '', error: err.message, type: 'text' };
  }
};

export const runCode = async (language: string, code: string) => {
  switch (language.toLowerCase()) {
    case 'python':
      return await runPython(code);
    case 'sql':
      // Simplified SQL runner using local state or mock
      return { output: "SQL execution not fully implemented in WASM yet.", type: 'text' };
    default:
      return { error: `Language ${language} is not supported yet.`, output: '', type: 'text' };
  }
};
