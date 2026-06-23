import { useEffect, useState } from 'react';
import { api } from '@/api';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/lib/useAsync';
import { Button } from '@/components/ui';
import { Field, TextInput, Select } from '@/components/Modal';
import type { CompanySettings } from '@/types';

const TIMEZONES = ['America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza', 'America/Recife', 'America/Bahia'];

interface CompanyForm { display_name: string; logo_url: string }
interface AppForm { app_name: string; app_subtitle: string; timezone: string; locale: string }

export function AdminSettings() {
  const toast = useToast();
  const settings = useAsync<CompanySettings>(() => api.company.get(), []);
  const [companyForm, setCompanyForm] = useState<CompanyForm | null>(null);
  const [appForm, setAppForm] = useState<AppForm | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingApp, setSavingApp] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    if (!companyForm) setCompanyForm({ display_name: settings.data.display_name ?? '', logo_url: settings.data.logo_url ?? '' });
    if (!appForm) {
      setAppForm({
        app_name: settings.data.app_name ?? '', app_subtitle: settings.data.app_subtitle ?? '',
        timezone: settings.data.timezone, locale: settings.data.locale,
      });
    }
  }, [settings.data, companyForm, appForm]);

  async function handleSaveCompany() {
    if (!companyForm || savingCompany) return;
    setSavingCompany(true);
    try {
      const updated = await api.company.update({
        display_name: companyForm.display_name.trim() || null,
        logo_url: companyForm.logo_url.trim() || null,
      });
      settings.setData(updated);
      toast.success('Dados da empresa salvos');
    } catch (err) {
      toast.error('Não foi possível salvar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleSaveApp() {
    if (!appForm || savingApp) return;
    setSavingApp(true);
    try {
      const updated = await api.company.update({
        app_name: appForm.app_name.trim() || null,
        app_subtitle: appForm.app_subtitle.trim() || null,
        timezone: appForm.timezone,
        locale: appForm.locale,
      });
      settings.setData(updated);
      toast.success('Configurações do app salvas');
    } catch (err) {
      toast.error('Não foi possível salvar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setSavingApp(false);
    }
  }

  return (
    <div className="cp-fade" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 18 }}>Dados da empresa</div>
        <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>Quem é o cliente que usa o sistema — só organizacional, não muda nada na aparência do app</div>
      </div>

      {!companyForm ? (
        <div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>Carregando…</div>
      ) : (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
          <Field label="Nome da empresa"><TextInput value={companyForm.display_name} onChange={(e) => setCompanyForm({ ...companyForm, display_name: e.target.value })} placeholder="Ex.: Nagib Comunicação e Marketing" /></Field>
          <Field label="URL do logo da empresa"><TextInput value={companyForm.logo_url} onChange={(e) => setCompanyForm({ ...companyForm, logo_url: e.target.value })} placeholder="https://…" /></Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={handleSaveCompany}>{savingCompany ? 'Salvando…' : 'Salvar dados da empresa'}</Button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 28, marginBottom: 12 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 18 }}>Configurações do app</div>
        <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>Como o produto se apresenta e se comporta — nome e fuso/idioma usados no sidebar e no sistema</div>
      </div>

      {!appForm ? (
        <div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>Carregando…</div>
      ) : (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
          <Field label="Nome do app"><TextInput value={appForm.app_name} onChange={(e) => setAppForm({ ...appForm, app_name: e.target.value })} placeholder="Ex.: CreatorsPro (padrão se vazio)" /></Field>
          <Field label="Segunda linha do app"><TextInput value={appForm.app_subtitle} onChange={(e) => setAppForm({ ...appForm, app_subtitle: e.target.value })} placeholder="Ex.: OPERAÇÕES (padrão se vazio)" /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Fuso horário">
              <Select value={appForm.timezone} onChange={(e) => setAppForm({ ...appForm, timezone: e.target.value })}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </Select>
            </Field>
            <Field label="Idioma">
              <Select value={appForm.locale} onChange={(e) => setAppForm({ ...appForm, locale: e.target.value })}>
                <option value="pt-BR">Português (Brasil)</option>
              </Select>
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={handleSaveApp}>{savingApp ? 'Salvando…' : 'Salvar configurações do app'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
