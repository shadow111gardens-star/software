import { useEffect, useState } from 'react';
import { useLocalFlow } from '../../app/local-flow-context';
import type { PreferencePatch } from '../../../shared/types/local-flow';
function NumberPreference({ label, field, value, min, max, step = 1, save }: { label: string; field: string; value: number; min: number; max: number; step?: number; save(value: number): PreferencePatch }) {
  const { busy, run } = useLocalFlow(); const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <label className="preference-row"><span>{label}</span><input data-preference={field} aria-label={label} type="number" min={min} max={max} step={step} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} onBlur={event => { if (event.target.value.trim() && event.target.checkValidity() && Number(draft) !== value) void run(() => window.animeCursor.flow.preferences(save(Number(draft)))); else if (!event.target.value.trim()) setDraft(String(value)); else if (!event.target.checkValidity()) { event.target.reportValidity(); setDraft(String(value)); } }} /></label>;
}
export function Appearance() {
  const { snapshot } = useLocalFlow(); if (!snapshot) return null; const settings = snapshot.settings;
  return <section className="preferences"><h2>Appearance</h2><p className="muted">Changes save when you leave a field.</p>
    <NumberPreference label="Character size (px)" field="size" value={settings.characterSize} min={16} max={512} save={characterSize => ({ characterSize })} />
    <NumberPreference label="Cursor distance — horizontal (px)" field="offset-x" value={settings.cursorOffset.x} min={-1000} max={1000} save={x => ({ cursorOffset: { ...settings.cursorOffset, x } })} />
    <NumberPreference label="Cursor distance — vertical (px)" field="offset-y" value={settings.cursorOffset.y} min={-1000} max={1000} save={y => ({ cursorOffset: { ...settings.cursorOffset, y } })} />
    <NumberPreference label="Opacity (%)" field="opacity" value={Math.round(settings.opacity * 100)} min={0} max={100} save={value => ({ opacity: value / 100 })} />
    <NumberPreference label="Smoothing (%)" field="smoothing" value={Math.round(settings.smoothing * 100)} min={0} max={100} save={value => ({ smoothing: value / 100 })} />
  </section>;
}
