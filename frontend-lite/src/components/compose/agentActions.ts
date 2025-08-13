export type AgentAction = { name: string; args?: any };

// Basic DOM operations dispatcher following Superwizard-style contract.
// Extend safely with app-specific behaviors and EB2 triggers.
export async function dispatchAgentAction(action: AgentAction): Promise<void> {
  if (!action || typeof action !== 'object') return;
  const name = String(action.name || '').toLowerCase();
  const args = action.args;
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
