import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { AppLayout } from '@/components/AppLayout';
import { Login } from '@/screens/Login';
import { AdminUsers } from '@/screens/AdminUsers';
import { Dashboard } from '@/screens/Dashboard';
import { Tasks } from '@/screens/Tasks';
import { Services } from '@/screens/Services';
import { Schedule } from '@/screens/Schedule';
import { Absences } from '@/screens/Absences';
import { Shifts } from '@/screens/Shifts';
import { Messages } from '@/screens/Messages';
import { Reports } from '@/screens/Reports';
import { Cadastros } from '@/screens/Cadastros';

export function App() {
  const { user } = useApp();

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // Admin tem uma área enxuta e exclusiva (gestão de usuários).
  if (user.role === 'admin') {
    return (
      <Routes>
        <Route path="/admin" element={<AdminUsers />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  // Coordenador / Operacional → app completo.
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tarefas" element={<Tasks />} />
        <Route path="/servicos" element={<Services />} />
        <Route path="/escala" element={<Schedule />} />
        <Route path="/ausencias" element={<Absences />} />
        <Route path="/plantoes" element={<Shifts />} />
        <Route path="/mensagens" element={<Messages />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/cadastros" element={<Cadastros />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
