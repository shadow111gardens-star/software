import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LocalFlowSnapshot, LocalProduct } from '../../shared/types/local-flow';
import { PurchaseNotice } from '../components/local-flow/PurchaseNotice';
interface FlowView { snapshot: LocalFlowSnapshot | null; products: LocalProduct[]; busy: boolean; error: string; message: string; run(work: () => Promise<LocalFlowSnapshot>): Promise<void>; buy(id: string): Promise<void> }
const Context = createContext<FlowView | null>(null);
export function LocalFlowProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<LocalFlowSnapshot | null>(null); const [products, setProducts] = useState<LocalProduct[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const pending = useRef(false); const revision = useRef(0);
  useEffect(() => {
    let mounted = true; let timer: ReturnType<typeof setTimeout>;
    void window.animeCursor.flow.getProducts().then(value => { if (mounted) setProducts(value); }).catch(() => { if (mounted) setError('The local catalog could not load.'); });
    const read = async () => {
      const current = revision.current;
      try { if (!pending.current) { const value = await window.animeCursor.flow.getSnapshot(); if (mounted && current === revision.current && !pending.current) setSnapshot(value); } }
      catch { if (mounted) setError('The local application could not be read. Restart Anime Cursor to try again.'); }
      finally { if (mounted) timer = setTimeout(() => void read(), 500); }
    };
    void read(); return () => { mounted = false; clearTimeout(timer); };
  }, []);
  const run = async (work: () => Promise<LocalFlowSnapshot>) => {
    if (pending.current) return; pending.current = true; ++revision.current; setBusy(true); setError(''); setMessage('');
    try { setSnapshot(await work()); } catch (failure) { setError(failure instanceof Error ? failure.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'This local action could not finish.'); }
    finally { ++revision.current; pending.current = false; setBusy(false); }
  };
  const buy = async (id: string) => { try { setMessage(await window.animeCursor.flow.buy(id)); } catch { setError('This product is not available for a mock purchase.'); } };
  return <Context.Provider value={{ snapshot, products, busy, error, message, run, buy }}>{children}{message&&<PurchaseNotice close={()=>setMessage('')}/>}</Context.Provider>;
}
export function useLocalFlow(): FlowView { const context = useContext(Context); if (!context) throw new Error('Local flow provider missing'); return context; }
