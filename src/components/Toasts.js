import { html } from '../lib.react.js';

export function Toasts({ messages }) {
  return html`<div className="fixed bottom-4 right-4 z-50 space-y-2">
    ${messages.map(
      (m) => html`<div className=${`rounded-lg px-4 py-2 text-white shadow ${m.type === 'error'
        ? 'bg-red-600'
        : m.type === 'success'
          ? 'bg-emerald-600'
          : 'bg-slate-700'}`}>
        ${m.text}
      </div>`
    )}
  </div>`;
}
