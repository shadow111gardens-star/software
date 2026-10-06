import { LocalFlowProvider } from './app/local-flow-context';
import { AppShell } from './app/AppShell';
export function App() { return <LocalFlowProvider><AppShell /></LocalFlowProvider>; }
