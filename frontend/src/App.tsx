import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { AppLayout } from '@/components/AppLayout';
import { AdminLayout } from '@/components/AdminLayout';
import { Login } from '@/screens/Login';
import { Signup } from '@/screens/Signup';
import { SignupSuccess } from '@/screens/SignupSuccess';
import { ClaimInvite } from '@/screens/ClaimInvite';
import { AdminUsers } from '@/screens/AdminUsers';
import { AdminBilling } from '@/screens/AdminBilling';
import { AdminSettings } from '@/screens/AdminSettings';
import { AdminAccount } from '@/screens/AdminAccount';
import { EditProfile } from '@/screens/EditProfile';
import { Dashboard } from '@/screens/Dashboard';
import { Tasks } from '@/screens/Tasks';
import { Services } from '@/screens/Services';
import { Schedule } from '@/screens/Schedule';
import { Absences } from '@/screens/Absences';
import { Shifts } from '@/screens/Shifts';
import { Messages } from '@/screens/Messages';
import { Reports } from '@/screens/Reports';
import { Cadastros } from '@/screens/Cadastros';
import { Profile } from '@/screens/Profile';

export function App() {
  const { user } = useApp();

  if (!user) {
    return (
      <Routes>
        <Route path="/cadastro" element={<Signup />} />
        <Route path="/cadastro/sucesso" element={<SignupSuccess />} />
        <Route path="/convite/:token" element={<ClaimInvite />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // Admin tem uma área enxuta e exclusiva (gestão de usuários + configurações da empresa).
  if (user.role === 'admin') {
    return (
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminUsers />} />
          <Route path="/admin/cobranca" element={<AdminBilling />} />
          <Route path="/admin/configuracoes" element={<AdminSettings />} />
          <Route path="/admin/conta" element={<AdminAccount />} />
          <Route path="/admin/perfil" element={<EditProfile />} />
        </Route>
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
        <Route path="/cadastros" element={user.role === 'operacional' ? <Navigate to="/dashboard" replace /> : <Cadastros />} />
        <Route path="/perfil" element={user.role === 'operacional' ? <Profile /> : <EditProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
