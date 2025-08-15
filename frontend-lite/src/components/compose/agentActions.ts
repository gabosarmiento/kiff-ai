export type AgentAction = { name: string; args?: any };

// Normalize a variety of arg formats (JSON string, "key: value" pairs, raw URL/selector) into structured objects
function normalizeArgs(arg: any, name?: string): any {
  if (arg == null) return arg;
  if (typeof arg === 'object') return arg;
  if (typeof arg === 'string') {
    const s = arg.trim();
    if (!s) return s;
    // Try JSON parse first
    try {
      const parsed = JSON.parse(s);
      return parsed;
    } catch {}
    // Allow raw URL string for navigate
    if (name && name.toLowerCase() === 'navigate') return s;
    // Parse simple "key: value, key2: value2" patterns
    const obj: Record<string, any> = {};
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const i = part.indexOf(':');
      if (i === -1) continue;
      const key = part.slice(0, i).trim().replace(/^['"]|['"]$/g, '');
      let val = part.slice(i + 1).trim();
      val = val.replace(/^['"]|['"]$/g, '');
      if (/^-?\d+(?:\.\d+)?$/.test(val)) obj[key] = Number(val);
      else if (val === 'true' || val === 'false') obj[key] = val === 'true';
      else obj[key] = val;
    }
    // Heuristics / aliases
    if ((obj as any).sel && !(obj as any).selector) (obj as any).selector = (obj as any).sel;
    if ((obj as any).val != null && (obj as any).value === undefined) (obj as any).value = (obj as any).val;
    if (!Object.keys(obj).length) {
      // map plain selector strings to { selector }
      if (s.startsWith('#') || s.startsWith('.')) return { selector: s };
      return s;
    }
    return obj;
  }
  return arg;
}

// Basic DOM operations dispatcher following Superwizard-style contract.
// Extend safely with app-specific behaviors and EB2 triggers.
export async function dispatchAgentAction(action: AgentAction): Promise<void> {
  if (!action || typeof action !== 'object') return;
  const name = String(action.name || '').toLowerCase();
  const args = normalizeArgs(action.args, name);
  try {
    switch (name) {
      case 'navigate':
        return navigateAction(args);
      case 'click':
        return clickAction(args);
      case 'setvalue':
      case 'set_value':
        return setValueAction(args);
      case 'respond':
        return respondAction(args);
      case 'finish':
        return finishAction(args);
      case 'fail':
        return failAction(args);
      case 'waiting':
        return waitingAction(args);
      case 'memory':
        return memoryAction(args);
      default:
        // Unknown actions are ignored for now
        return;
    }
  } catch (e) {
    console.warn('dispatchAgentAction error', e);
  }
}

async function navigateAction(arg: any) {
  const url = typeof arg === 'string' ? arg : (arg?.url || arg);
  if (!url) return;
  // For preview:// scheme, you could route to Run tab or set internal state
  if (typeof window !== 'undefined') {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener');
    } else {
      // No-op or client-side route if integrated
      console.debug('navigateAction:', url);
    }
  }
}

async function clickAction(arg: any) {
  const sel = typeof arg === 'string' ? arg : (arg?.selector || arg?.sel);
  if (!sel || typeof document === 'undefined') return;
  const el = document.querySelector(sel) as HTMLElement | null;
  el?.click?.();
}

async function setValueAction(arg: any) {
  const sel = arg?.selector || arg?.sel;
  const value = arg?.value ?? arg?.val ?? '';
  if (!sel || typeof document === 'undefined') return;
  const el = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
  if (el) {
    (el as any).value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

async function respondAction(arg: any) {
  console.debug('respondAction:', arg);
}

async function finishAction(arg: any) {
  console.debug('finishAction:', arg);
}

async function failAction(arg: any) {
  console.warn('failAction:', arg);
}

async function waitingAction(arg: any) {
  console.debug('waitingAction:', arg);
}

async function memoryAction(arg: any) {
  console.debug('memoryAction:', arg);
}
