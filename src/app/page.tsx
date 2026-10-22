'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  CalendarCheck,
  BarChart3,
  Cpu,
  Plus,
  Search,
  MessageCircle,
  Phone,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Clock,
  Filter,
  Upload,
  Send,
  Sparkles,
  ChevronRight,
  UserCheck,
  Eye,
  Check,
  ArrowUpRight,
  Copy,
  RefreshCw,
  Edit3,
  LayoutGrid,
  Table as TableIcon,
  Bell,
  Lightbulb,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Lead,
  SellerFeedback,
  SELLERS_LIST,
  ORIGINS_LIST,
  STAGES_LIST,
  STATUS_LIST,
  OBJECTIONS_LIST,
  CHANNELS_LIST,
  CadenceItem,
} from '@/types/crm';
import { computeAnalytics, getCadenceProgress } from '@/lib/analytics';
import { generateLeadSuggestion } from '@/lib/suggestions';

export default function AutocarCRMApp() {
  // Active Role & User Profile
  const [currentUserId, setCurrentUserId] = useState<string>('admin-1');
  const currentUser = useMemo(
    () => SELLERS_LIST.find((u) => u.id === currentUserId) || SELLERS_LIST[0],
    [currentUserId]
  );

  // Admin filter for seller ('Todos' or seller name)
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('Todos');

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    'leads' | 'kanban' | 'followup' | 'suggestions' | 'dashboard' | 'mcp'
  >('dashboard');
  const [suggestionFilter, setSuggestionFilter] = useState<'TODOS' | 'URGENTE HOJE' | 'PROPOSTAS' | 'RESGATE_D10'>('TODOS');
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);

  // Data State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [feedbacks, setFeedbacks] = useState<SellerFeedback[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Quick Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('Todas');
  const [originFilter, setOriginFilter] = useState('Todas');
  const [onlyPendingFollowup, setOnlyPendingFollowup] = useState(false);

  // Modals State
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  // New Lead Form State
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    phone: '',
    origin: 'Tráfego pago',
    vehicle: '',
    qualified: 'A verificar',
    stage: '1º Contato',
    status: 'Aguardando',
    contactUnder5Min: 'Sim',
    proposalValue: '',
    mainObjection: '',
    notes: '',
    seller: 'Anne',
    channel: 'WhatsApp',
  });

  // New Feedback Form State (Admin / MCP)
  const [feedbackForm, setFeedbackForm] = useState({
    targetSeller: 'Anne',
    severity: 'atencao' as 'positivo' | 'atencao' | 'critico',
    title: '',
    message: '',
    author: 'Gestor',
  });

  // Load initial data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [leadsRes, fbRes] = await Promise.all([fetch('/api/leads'), fetch('/api/feedbacks')]);
        const leadsJson = await leadsRes.json();
        const fbJson = await fbRes.json();

        const localLeads = localStorage.getItem('autocar_crm_leads_v1');
        if (localLeads) {
          setLeads(JSON.parse(localLeads));
        } else if (leadsJson.leads) {
          setLeads(leadsJson.leads);
          localStorage.setItem('autocar_crm_leads_v1', JSON.stringify(leadsJson.leads));
        }

        const localFb = localStorage.getItem('autocar_crm_fb_v1');
        if (localFb) {
          setFeedbacks(JSON.parse(localFb));
        } else if (fbJson.feedbacks) {
          setFeedbacks(fbJson.feedbacks);
          localStorage.setItem('autocar_crm_fb_v1', JSON.stringify(fbJson.feedbacks));
        }
      } catch (e) {
        console.error('Erro ao carregar dados:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // When switching user profile:
  useEffect(() => {
    if (currentUser.role === 'seller') {
      setSelectedSellerFilter(currentUser.name);
      if (activeTab === 'mcp') setActiveTab('leads');
    } else {
      setSelectedSellerFilter('Todos');
    }
  }, [currentUser, activeTab]);

  // Persist helper
  const syncLeads = async (updated: Lead[]) => {
    setLeads(updated);
    localStorage.setItem('autocar_crm_leads_v1', JSON.stringify(updated));
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: updated }),
      });
    } catch {
      // fallback localStorage
    }
  };

  const syncFeedbacks = async (updated: SellerFeedback[]) => {
    setFeedbacks(updated);
    localStorage.setItem('autocar_crm_fb_v1', JSON.stringify(updated));
  };

  // Filtered leads based on role + seller filter
  const roleScopedLeads = useMemo(() => {
    if (currentUser.role === 'seller') {
      return leads.filter((l) => l.seller.toLowerCase() === currentUser.name.toLowerCase());
    }
    if (selectedSellerFilter !== 'Todos') {
      return leads.filter((l) => l.seller.toLowerCase() === selectedSellerFilter.toLowerCase());
    }
    return leads;
  }, [leads, currentUser, selectedSellerFilter]);

  // Search & UI filtered leads
  const visibleLeads = useMemo(() => {
    return roleScopedLeads.filter((l) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        l.vehicle.toLowerCase().includes(q) ||
        l.notes.toLowerCase().includes(q);
      const matchStage = stageFilter === 'Todas' || l.stage === stageFilter;
      const matchOrigin = originFilter === 'Todas' || l.origin === originFilter;
      if (!matchSearch || !matchStage || !matchOrigin) return false;

      if (onlyPendingFollowup) {
        const prog = getCadenceProgress(l);
        return l.stage !== 'Fechado' && l.stage !== 'Perdido' && prog.doneDays < 10;
      }
      return true;
    });
  }, [roleScopedLeads, searchQuery, stageFilter, originFilter, onlyPendingFollowup]);

  // Analytics computed on roleScopedLeads
  const analytics = useMemo(() => computeAnalytics(roleScopedLeads), [roleScopedLeads]);
  const globalAnalytics = useMemo(() => computeAnalytics(leads), [leads]);

  // Visible feedbacks for current seller/admin
  const visibleFeedbacks = useMemo(() => {
    if (currentUser.role === 'seller') {
      return feedbacks.filter(
        (f) => f.targetSeller.toLowerCase() === currentUser.name.toLowerCase() || f.targetSeller === 'Todos'
      );
    }
    if (selectedSellerFilter !== 'Todos') {
      return feedbacks.filter(
        (f) => f.targetSeller.toLowerCase() === selectedSellerFilter.toLowerCase() || f.targetSeller === 'Todos'
      );
    }
    return feedbacks;
  }, [feedbacks, currentUser, selectedSellerFilter]);

  // WhatsApp direct link helper
  const getWhatsAppUrl = (lead: Lead, customDay?: number, customScript?: string) => {
    const cleanPhone = lead.phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const vehicleText = lead.vehicle ? ` para o seu ${lead.vehicle}` : '';
    const msg = customScript
      ? customScript.replace(/^\[Enviar em Áudio WZ de 20s\]:\s*"?|"?$/g, '')
      : customDay
      ? `Olá ${lead.name}, tudo bem? Aqui é a ${lead.seller} da Autocar Proteção Veicular! Estou passando no nosso ${customDay}º dia de acompanhamento para saber se conseguiu avaliar a proposta de proteção${vehicleText}. Ficou alguma dúvida?`
      : `Olá ${lead.name}, tudo bem? Aqui é a ${lead.seller} da Autocar Proteção Veicular! Vi seu interesse na proteção${vehicleText} e gostaria de te ajudar.`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  };

  // Toggle a single day (D+1..D+10) in a lead's cadence
  const toggleCadenceDay = (leadId: string, day: number) => {
    const updated = leads.map((l) => {
      if (l.id !== leadId) return l;
      const current = l.cadence?.[`d${day}`] || {
        day,
        status: 'Pendente',
        date: null,
        channel: l.channel || 'WhatsApp',
        responded: false,
      };
      const nextStatus: CadenceItem['status'] =
        current.status === 'Pendente'
          ? 'Feito'
          : current.status === 'Feito'
          ? 'Pulado'
          : 'Pendente';

      const newCadence = {
        ...l.cadence,
        [`d${day}`]: {
          ...current,
          status: nextStatus,
          date: nextStatus === 'Feito' ? new Date().toISOString().split('T')[0] : null,
          channel: l.channel || 'WhatsApp',
        },
      };
      const doneCount = Object.values(newCadence).filter((c) => c.status === 'Feito').length;
      return {
        ...l,
        cadence: newCadence,
        contactsCount: Math.max(doneCount, 1),
      };
    });
    syncLeads(updated);
  };

  // Quick update lead field inline
  const updateLeadField = (leadId: string, field: keyof Lead, value: unknown) => {
    const updated = leads.map((l) => {
      if (l.id !== leadId) return l;
      const copy: Lead = { ...l, [field]: value };
      if (field === 'stage') {
        if (value === 'Fechado') {
          copy.result = 'Fechado';
          copy.status = 'Associado';
          copy.closingDate = copy.closingDate || new Date().toISOString().split('T')[0];
        } else if (value === 'Perdido') {
          copy.result = 'Perdido';
        } else {
          copy.result = 'Em aberto';
        }
      }
      return copy;
    });
    syncLeads(updated);
  };

  // Create new lead
  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().split('T')[0];
    const cadence: Record<string, CadenceItem> = {};
    for (let d = 1; d <= 10; d++) {
      cadence[`d${d}`] = {
        day: d,
        status: d === 1 ? 'Feito' : 'Pendente',
        date: d === 1 ? today : null,
        channel: d === 1 ? newLeadForm.channel : null,
        responded: false,
      };
    }

    const sellerName = currentUser.role === 'seller' ? currentUser.name : newLeadForm.seller;
    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      number: leads.length + 1,
      entryDate: today,
      name: newLeadForm.name,
      phone: newLeadForm.phone,
      origin: newLeadForm.origin,
      vehicle: newLeadForm.vehicle,
      qualified: newLeadForm.qualified,
      stage: newLeadForm.stage,
      status: newLeadForm.stage === 'Fechado' ? 'Associado' : newLeadForm.status,
      contactUnder5Min: newLeadForm.contactUnder5Min,
      firstContactDate: today,
      contactsCount: 1,
      mainObjection: newLeadForm.mainObjection,
      proposalValue: newLeadForm.proposalValue ? parseFloat(newLeadForm.proposalValue) : null,
      closingDate: newLeadForm.stage === 'Fechado' ? today : null,
      result:
        newLeadForm.stage === 'Fechado'
          ? 'Fechado'
          : newLeadForm.stage === 'Perdido'
          ? 'Perdido'
          : 'Em aberto',
      notes: newLeadForm.notes,
      seller: sellerName,
      channel: newLeadForm.channel,
      responded: 'Pendente',
      noResponseReason: '',
      followupStatus: 'Em andamento',
      nextContactDate: today,
      cadence,
    };

    syncLeads([newLead, ...leads]);
    setIsNewLeadModalOpen(false);
    setNewLeadForm({
      name: '',
      phone: '',
      origin: 'Tráfego pago',
      vehicle: '',
      qualified: 'A verificar',
      stage: '1º Contato',
      status: 'Aguardando',
      contactUnder5Min: 'Sim',
      proposalValue: '',
      mainObjection: '',
      notes: '',
      seller: sellerName,
      channel: 'WhatsApp',
    });
  };

  // Save edited lead
  const handleSaveEditedLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    const updated = leads.map((l) => (l.id === editingLead.id ? editingLead : l));
    syncLeads(updated);
    setEditingLead(null);
  };

  // Send Feedback (Admin or Automated Claude Simulation)
  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    const newFb: SellerFeedback = {
      id: `fb-${Date.now()}`,
      createdAt: new Date().toISOString(),
      targetSeller: feedbackForm.targetSeller,
      author: feedbackForm.author,
      severity: feedbackForm.severity,
      title: feedbackForm.title,
      message: feedbackForm.message,
      read: false,
    };
    const updated = [newFb, ...feedbacks];
    syncFeedbacks(updated);
    await fetch('/api/feedbacks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newFb),
    });
    setIsFeedbackModalOpen(false);
    setFeedbackForm({
      targetSeller: 'Anne',
      severity: 'atencao',
      title: '',
      message: '',
      author: 'Gestor',
    });
  };

  // Generate AI Feedback with 1 click based on live diagnostics
  const generateSmartMcpFeedback = async (sellerName: string) => {
    const sellerLeads = leads.filter((l) => sellerName === 'Todos' || l.seller === sellerName);
    const stats = computeAnalytics(sellerLeads);
    const openProposals = sellerLeads
      .filter((l) => l.stage === 'Proposta enviada')
      .map((l) => l.name)
      .slice(0, 5)
      .join(', ');

    const newFb: SellerFeedback = {
      id: `fb-${Date.now()}`,
      createdAt: new Date().toISOString(),
      targetSeller: sellerName === 'Todos' ? 'Anne' : sellerName,
      author: 'Claude MCP',
      severity: stats.prematureLostCount > 0 ? 'critico' : 'atencao',
      title: `Diagnóstico Automático Claude MCP — Cadência D+10 & Propostas`,
      message: `Resumo da base (${stats.total} leads): Taxa de conversão em ${stats.conversionRate.toFixed(
        1
      )}% (${stats.closedCount} fechados) e contato <=5min em ${stats.fastContactRate.toFixed(
        1
      )}%. Atenção: existem ${
        stats.prematureLostCount
      } leads descartados antes de completar os 10 dias de follow-up (D+10). Ação imediata hoje: contatar por Ligação/Áudio WZ os leads com Proposta Enviada (${
        openProposals || 'nenhum pendente'
      }).`,
      read: false,
    };
    const updated = [newFb, ...feedbacks];
    syncFeedbacks(updated);
    await fetch('/api/feedbacks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newFb),
    });
  };

  // Import XLSX/CSV spreadsheet
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rows = XLSX.utils.sheet_to_json< unknown[] >(ws, { header: 1 });
      const imported: Lead[] = [];
      const today = new Date().toISOString().split('T')[0];

      rows.slice(3).forEach((row, idx) => {
        if (!Array.isArray(row) || !row[2]) return;
        const cadence: Record<string, CadenceItem> = {};
        for (let d = 1; d <= 10; d++) {
          cadence[`d${d}`] = {
            day: d,
            status: d === 1 ? 'Feito' : 'Pendente',
            date: d === 1 ? today : null,
            channel: 'WhatsApp',
            responded: false,
          };
        }
        imported.push({
          id: `imp-${Date.now()}-${idx}`,
          number: leads.length + imported.length + 1,
          entryDate: today,
          name: String(row[2] || '').trim(),
          phone: String(row[3] || '').trim(),
          origin: String(row[4] || 'Outros').trim(),
          vehicle: String(row[5] || '').trim(),
          qualified: String(row[6] || 'A verificar').trim(),
          stage: String(row[7] || '1º Contato').trim(),
          status: String(row[8] || 'Aguardando').trim(),
          contactUnder5Min: String(row[9] || 'Sim').trim(),
          firstContactDate: today,
          contactsCount: Number(row[15] || 1),
          mainObjection: String(row[16] || '').trim(),
          proposalValue: row[17] ? parseFloat(String(row[17]).replace(/[^\d.,]/g, '').replace(',', '.')) : null,
          closingDate: null,
          result: String(row[19] || 'Em aberto').trim(),
          notes: String(row[20] || '').trim(),
          seller: String(row[21] || (currentUser.role === 'seller' ? currentUser.name : 'Anne')).trim(),
          channel: 'WhatsApp',
          responded: 'Pendente',
          noResponseReason: '',
          followupStatus: 'Em andamento',
          nextContactDate: today,
          cadence,
        });
      });

      if (imported.length > 0) {
        syncLeads([...imported, ...leads]);
        alert(`${imported.length} leads importados da planilha com sucesso!`);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* TOP BAR */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight text-white">
                  AUTOCAR <span className="text-blue-400">CRM</span>
                </h1>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Proteção Veicular
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Controle Comercial · Cadência D+1 a D+10 · Integração Claude MCP
              </p>
            </div>
          </div>

          {/* Right Controls: Role Switcher & Actions */}
          <div className="flex items-center gap-3">
            {/* Switch Profile (Simulador de Login Vendedor vs Admin) */}
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5">
              <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-400 block text-[10px] leading-none">Acesso Logado:</span>
                <select
                  value={currentUserId}
                  onChange={(e) => setCurrentUserId(e.target.value)}
                  className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer pr-2"
                >
                  {SELLERS_LIST.map((u) => (
                    <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                      {u.role === 'admin' ? `👑 ${u.name}` : `👩‍💼 Vendedor(a): ${u.name}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Admin Seller Filter */}
            {currentUser.role === 'admin' && (
              <div className="hidden lg:flex items-center gap-2 bg-slate-800/60 border border-slate-700/80 rounded-xl px-3 py-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <div className="text-xs">
                  <span className="text-slate-400 block text-[10px] leading-none">Visão da Vendedora:</span>
                  <select
                    value={selectedSellerFilter}
                    onChange={(e) => setSelectedSellerFilter(e.target.value)}
                    className="bg-transparent text-emerald-400 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="Todos" className="bg-slate-900 text-white">
                      Todas as Vendedoras ({leads.length} leads)
                    </option>
                    {SELLERS_LIST.filter((s) => s.role === 'seller').map((s) => (
                      <option key={s.id} value={s.name} className="bg-slate-900 text-white">
                        {s.name} ({leads.filter((l) => l.seller === s.name).length} leads)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Import XLSX Button */}
            <label className="cursor-pointer hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition">
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Importar Planilha</span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
            </label>

            {/* New Lead Button */}
            <button
              onClick={() => setIsNewLeadModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-600/25 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Lead</span>
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto border-t border-slate-800/60 bg-slate-900/50">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'dashboard'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>
              {currentUser.role === 'admin'
                ? 'Dashboard & Diagnóstico (Admin)'
                : `Meu Desempenho (${currentUser.name})`}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('leads')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'leads'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-4 h-4" />
            <span>📋 CRM - Leads ({roleScopedLeads.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('followup')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'followup'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>🔁 Follow-up Diário (D+1 a D+10)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Meta 10º Dia
            </span>
          </button>

          <button
            onClick={() => setActiveTab('suggestions')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'suggestions'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lightbulb className="w-4 h-4 text-emerald-400" />
            <span>💡 Sugestões de Contato Ativo & Pontos de Atenção</span>
          </button>

          <button
            onClick={() => setActiveTab('kanban')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'kanban'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>🔽 Funil Kanban</span>
          </button>

          <button
            onClick={() => setActiveTab('mcp')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'mcp'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>🤖 Servidor MCP & Feedbacks Claude</span>
            {visibleFeedbacks.filter((f) => !f.read).length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500 text-white font-bold">
                {visibleFeedbacks.filter((f) => !f.read).length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* FEEDBACK BANNER FOR SELLERS (RECEIVED FROM CLAUDE MCP OR ADMIN) */}
        {visibleFeedbacks.length > 0 && (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-purple-300">
                  Feedbacks & Orientações Ativas ({currentUser.role === 'seller' ? currentUser.name : selectedSellerFilter})
                </h2>
              </div>
              {currentUser.role === 'admin' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => generateSmartMcpFeedback(selectedSellerFilter)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-medium transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gerar Diagnóstico Claude MCP Agora</span>
                  </button>
                  <button
                    onClick={() => setIsFeedbackModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Feedback Manual</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {visibleFeedbacks.slice(0, 3).map((fb) => (
                <div
                  key={fb.id}
                  className={`rounded-xl p-3.5 border flex flex-col justify-between ${
                    fb.severity === 'critico'
                      ? 'bg-rose-950/25 border-rose-500/30'
                      : fb.severity === 'positivo'
                      ? 'bg-emerald-950/25 border-emerald-500/30'
                      : 'bg-amber-950/25 border-amber-500/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          fb.severity === 'critico'
                            ? 'bg-rose-500/20 text-rose-300'
                            : fb.severity === 'positivo'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {fb.author} → {fb.targetSeller}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(fb.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">{fb.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{fb.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 1: DASHBOARD & DIAGNOSTICO */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top KPI Cards with Autocar Sheet Goals */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Volume & Qualificação */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400">📥 VOLUME & QUALIFICAÇÃO</span>
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">{analytics.total}</span>
                  <span className="text-xs text-slate-400">leads cadastrados</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-300">
                    Qualificados (Sim): <strong>{analytics.qualifiedSim}</strong> ({analytics.qualifiedRate.toFixed(1)}%)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      analytics.qualifiedRate >= 60
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    Meta: &gt; 60%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      analytics.qualifiedRate >= 60 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, analytics.qualifiedRate)}%` }}
                  />
                </div>
              </div>

              {/* KPI 2: Velocidade de Contato <= 5 min */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400">⚡ VELOCIDADE (≤ 5 MIN)</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">{analytics.fastContactRate.toFixed(1)}%</span>
                  <span className="text-xs text-slate-400">
                    ({analytics.fastContactSim} Sim / {analytics.fastContactNao} Não)
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-300">Janela de Ouro (≤ 5 min)</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      analytics.fastContactRate >= 70
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    Meta: ≥ 70%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      analytics.fastContactRate >= 70 ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, analytics.fastContactRate)}%` }}
                  />
                </div>
              </div>

              {/* KPI 3: Taxa de Conversão Geral */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400">🎯 TAXA DE CONVERSÃO</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-emerald-400">{analytics.conversionRate.toFixed(1)}%</span>
                  <span className="text-xs text-slate-400">{analytics.closedCount} associados fechados</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-300">
                    Mensalidade acum.: <strong>R$ {analytics.totalRevenue.toFixed(2)}</strong>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      analytics.conversionRate >= 15
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    Meta: ≥ 15%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(100, (analytics.conversionRate / 30) * 100)}%` }}
                  />
                </div>
              </div>

              {/* KPI 4: Cadência D+10 & Regra de 3 Dias */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400">🔁 CADÊNCIA ATÉ D+10</span>
                  <CalendarCheck className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">{analytics.avgFollowupDays.toFixed(1)}</span>
                  <span className="text-xs text-slate-400">dias médios de follow-up</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-rose-300">
                    Descartados antes do D+10: <strong>{analytics.prematureLostCount}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300">
                    Meta: Ir até 10º dia
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{ width: `${Math.min(100, (analytics.avgFollowupDays / 10) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ADMIN DIAGNOSTIC ENGINE: PONTOS POSITIVOS E PONTOS DE FALHA */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    Diagnóstico Automático do Processo Comercial (Pontos Positivos & Falhas)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Análise em tempo real das métricas da planilha Autocar + regra de cadência até o 10º dia (D+10)
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('followup')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  <span>Ir para Fila Diária D+1 a D+10</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analytics.findings.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl p-4 border ${
                      item.type === 'positivo'
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : item.type === 'falha'
                        ? 'bg-rose-950/20 border-rose-500/30'
                        : 'bg-amber-950/20 border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {item.type === 'positivo' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : item.type === 'falha' ? (
                          <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                        )}
                        <div>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              item.type === 'positivo'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : item.type === 'falha'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {item.type === 'positivo'
                              ? 'Ponto Positivo'
                              : item.type === 'falha'
                              ? 'Ponto de Falha Crítico'
                              : 'Ponto de Atenção'}
                          </span>
                          <h3 className="text-sm font-bold text-white mt-1">{item.title}</h3>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-white block">{item.currentValue}</span>
                        <span className="text-[10px] text-slate-400">Meta: {item.targetValue}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">{item.description}</p>
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-200">
                        <strong className="text-blue-400">Plano de Ação:</strong> {item.actionableAdvice}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FUNNEL + ORIGINS + OBJECTIONS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Funil por Etapa */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
                  <span>🔽 FUNIL POR ETAPA</span>
                  <span className="text-xs font-normal text-slate-400">{analytics.total} leads</span>
                </h3>
                <div className="space-y-3">
                  {STAGES_LIST.map((stage) => {
                    const count = analytics.stageCounts[stage] || 0;
                    const pct = analytics.total > 0 ? (count / analytics.total) * 100 : 0;
                    const barColor =
                      stage === 'Fechado'
                        ? 'bg-emerald-500'
                        : stage === 'Perdido'
                        ? 'bg-rose-500'
                        : stage === 'Proposta enviada' || stage === 'Negociação'
                        ? 'bg-amber-500'
                        : 'bg-blue-500';
                    return (
                      <div key={stage}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-slate-200">{stage}</span>
                          <span className="text-slate-400">
                            <strong className="text-white">{count}</strong> ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Origem dos Fechamentos */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
                  <span>🟢 ORIGEM DOS FECHAMENTOS</span>
                  <span className="text-xs font-normal text-slate-400">De onde vêm os associados?</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2">ORIGEM</th>
                        <th className="pb-2 text-center">LEADS</th>
                        <th className="pb-2 text-center">FECHADOS</th>
                        <th className="pb-2 text-right">CONVERSÃO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {analytics.originsStats.map((o) => (
                        <tr key={o.origin}>
                          <td className="py-2.5 font-medium text-slate-200">{o.origin}</td>
                          <td className="py-2.5 text-center text-slate-300">{o.total}</td>
                          <td className="py-2.5 text-center font-bold text-emerald-400">{o.closed}</td>
                          <td className="py-2.5 text-right">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                o.conversionRate >= 15
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : o.total > 0 && o.conversionRate === 0
                                  ? 'bg-rose-500/15 text-rose-400'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {o.conversionRate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Objeções Mais Frequentes */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
                  <span>🔴 OBJEÇÕES MAIS FREQUENTES</span>
                  <span className="text-xs font-normal text-slate-400">Causas de perda/trava</span>
                </h3>
                <div className="space-y-2.5">
                  {OBJECTIONS_LIST.filter((o) => o !== '').map((obj) => {
                    const count = analytics.objectionsMap[obj] || 0;
                    return (
                      <div
                        key={obj}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/40 border border-slate-800 text-xs"
                      >
                        <span className="text-slate-200 font-medium">{obj}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold ${
                            count > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {count} {count === 1 ? 'lead' : 'leads'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RANKING POR VENDEDORA (ADMIN TABLE) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">👩 CONVERSÃO POR VENDEDORA (EQUIPE AUTOCAR)</h3>
                  <p className="text-xs text-slate-400">
                    Comparativo automático entre vendedores internos (corrigido em relação à aba Dashboard original)
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                      <th className="py-3 px-3">Vendedora</th>
                      <th className="py-3 px-3 text-center">Leads</th>
                      <th className="py-3 px-3 text-center">Qualif. (Sim)</th>
                      <th className="py-3 px-3 text-center">Contato ≤5min</th>
                      <th className="py-3 px-3 text-center">Fechados</th>
                      <th className="py-3 px-3 text-center">Perdidos</th>
                      <th className="py-3 px-3 text-center">Taxa %</th>
                      <th className="py-3 px-3 text-right">Receita Mensal</th>
                      <th className="py-3 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {globalAnalytics.sellerStats.map((s) => (
                      <tr key={s.seller} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 font-semibold text-white flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xs font-bold">
                            {s.seller.slice(0, 2).toUpperCase()}
                          </span>
                          {s.seller}
                        </td>
                        <td className="py-3 px-3 text-center font-medium">{s.total}</td>
                        <td className="py-3 px-3 text-center text-slate-300">
                          {s.qualified} ({s.qualifiedRate.toFixed(0)}%)
                        </td>
                        <td className="py-3 px-3 text-center text-slate-300">{s.fastRate.toFixed(0)}%</td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-400">{s.closed}</td>
                        <td className="py-3 px-3 text-center text-rose-400">{s.lost}</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              s.conversionRate >= 15
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : s.total > 0
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {s.conversionRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-200">
                          R$ {s.revenue.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedSellerFilter(s.seller);
                              setActiveTab('leads');
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                          >
                            Ver Leads →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CRM - LEADS (TABELA RÁPIDA ESTILO PLANILHA + WHATSAPP) */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nome, telefone, veículo ou observação..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="Todas">Etapa: Todas</option>
                  {STAGES_LIST.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select
                  value={originFilter}
                  onChange={(e) => setOriginFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="Todas">Origem: Todas</option>
                  {ORIGINS_LIST.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>

                <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyPendingFollowup}
                    onChange={(e) => setOnlyPendingFollowup(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-blue-600"
                  />
                  <span>Apenas em Follow-up Ativo (D+1..D+10)</span>
                </label>
              </div>

              <div className="text-xs text-slate-400">
                Exibindo <strong className="text-white">{visibleLeads.length}</strong> leads
              </div>
            </div>

            {/* Spreadsheet-like Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">Data</th>
                      <th className="py-3 px-3">Lead & WhatsApp</th>
                      <th className="py-3 px-3">Origem</th>
                      <th className="py-3 px-3">Veículo</th>
                      <th className="py-3 px-3">Qualif.?</th>
                      <th className="py-3 px-3">Etapa do Funil</th>
                      <th className="py-3 px-3">≤5m?</th>
                      <th className="py-3 px-3">Cadência (D+1 a D+10)</th>
                      <th className="py-3 px-3">Objeção</th>
                      <th className="py-3 px-3">Proposta</th>
                      <th className="py-3 px-3">Observações</th>
                      <th className="py-3 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {visibleLeads.map((lead) => {
                      const prog = getCadenceProgress(lead);
                      return (
                        <tr key={lead.id} className="hover:bg-slate-800/35 transition group">
                          <td className="py-3 px-3 font-mono text-slate-500">{lead.number}</td>
                          <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                            {lead.entryDate ? lead.entryDate.split('-').reverse().join('/') : '-'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{lead.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-slate-400 text-[11px]">{lead.phone}</span>
                              {lead.phone && (
                                <a
                                  href={getWhatsAppUrl(lead, prog.nextPendingDay || undefined)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold transition"
                                  title="Abrir conversa no WhatsApp com mensagem pronta"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>WhatsApp</span>
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px]">
                              {lead.origin}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-200 font-medium">{lead.vehicle || '-'}</td>
                          <td className="py-3 px-3">
                            <select
                              value={lead.qualified}
                              onChange={(e) => updateLeadField(lead.id, 'qualified', e.target.value)}
                              className={`rounded-lg px-2 py-1 text-[11px] font-semibold border focus:outline-none cursor-pointer ${
                                lead.qualified === 'Sim'
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : lead.qualified === 'Não'
                                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              <option value="Sim" className="bg-slate-900 text-white">
                                Sim
                              </option>
                              <option value="Não" className="bg-slate-900 text-white">
                                Não
                              </option>
                              <option value="A verificar" className="bg-slate-900 text-white">
                                A verificar
                              </option>
                            </select>
                          </td>
                          <td className="py-3 px-3">
                            <select
                              value={lead.stage}
                              onChange={(e) => updateLeadField(lead.id, 'stage', e.target.value)}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border focus:outline-none cursor-pointer ${
                                lead.stage === 'Fechado'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : lead.stage === 'Perdido'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : lead.stage === 'Proposta enviada'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              }`}
                            >
                              {STAGES_LIST.map((s) => (
                                <option key={s} value={s} className="bg-slate-900 text-white">
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() =>
                                updateLeadField(
                                  lead.id,
                                  'contactUnder5Min',
                                  lead.contactUnder5Min === 'Sim' ? 'Não' : 'Sim'
                                )
                              }
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                                lead.contactUnder5Min === 'Sim'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {lead.contactUnder5Min}
                            </button>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => {
                                const c = lead.cadence?.[`d${d}`];
                                const st = c?.status || 'Pendente';
                                return (
                                  <button
                                    key={d}
                                    onClick={() => toggleCadenceDay(lead.id, d)}
                                    title={`D+${d}: ${st} (Clique para alternar Feito / Pulado / Pendente)`}
                                    className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center transition cursor-pointer ${
                                      st === 'Feito'
                                        ? 'bg-emerald-500 text-slate-950'
                                        : st === 'Pulado'
                                        ? 'bg-slate-700 text-slate-400 line-through'
                                        : st === 'Encerrado'
                                        ? 'bg-emerald-950 text-emerald-500 border border-emerald-700/40'
                                        : 'bg-slate-800 text-slate-400 hover:border-blue-400 border border-slate-700'
                                    }`}
                                  >
                                    {d}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                              <span>{prog.doneDays}/10 dias feitos</span>
                              {prog.isPrematurelyLost && (
                                <span className="text-rose-400 font-semibold">⚠️ Parou antes do D+10</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <select
                              value={lead.mainObjection || ''}
                              onChange={(e) => updateLeadField(lead.id, 'mainObjection', e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
                            >
                              <option value="">Sem objeção</option>
                              {OBJECTIONS_LIST.filter((o) => o !== '').map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-3 font-semibold text-emerald-400 whitespace-nowrap">
                            {lead.proposalValue ? `R$ ${lead.proposalValue.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 px-3 max-w-[240px]">
                            <p className="text-slate-300 truncate" title={lead.notes}>
                              {lead.notes || '-'}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setEditingLead(lead)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                              title="Editar Lead Completo"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FOLLOW-UP DIÁRIO (CADÊNCIA D+1 ATÉ D+10) */}
        {activeTab === 'followup' && (
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-blue-400" />
                  Régua de Follow-up Diário — Recomendação Até o 10º Dia (D+1 a D+10)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Clique nos blocos de <strong>D+1 até D+10</strong> para marcar o follow-up de hoje como feito e abra o WhatsApp com mensagem contextualizada para aquele dia.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Feito
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-800 border border-slate-600 inline-block" /> Pendente
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-700 inline-block" /> Pulado
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {roleScopedLeads
                .filter((l) => l.stage !== 'Fechado')
                .map((lead) => {
                  const prog = getCadenceProgress(lead);
                  return (
                    <div
                      key={lead.id}
                      className={`bg-slate-900 border rounded-2xl p-4 transition ${
                        prog.isPrematurelyLost
                          ? 'border-rose-500/40 bg-rose-950/10'
                          : prog.isStaleOver3Days
                          ? 'border-amber-500/40'
                          : 'border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Left Info */}
                        <div className="space-y-1 min-w-[260px]">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-500">#{lead.number}</span>
                            <h3 className="text-sm font-bold text-white">{lead.name}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-300">
                              {lead.stage}
                            </span>
                            {lead.vehicle && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
                                🚗 {lead.vehicle}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">
                            Entrada: {lead.entryDate.split('-').reverse().join('/')} · Origem: {lead.origin} · Canal:{' '}
                            <strong className="text-slate-200">{lead.channel}</strong>
                          </p>
                          {lead.notes && <p className="text-xs text-slate-300 italic">&ldquo;{lead.notes}&rdquo;</p>}
                          {prog.isPrematurelyLost && (
                            <p className="text-[11px] text-rose-400 font-semibold">
                              ⚠️ Alerta de Processo: Marcado como Perdido com apenas {prog.doneDays}/10 dias de tentativa. Retome até o D+10!
                            </p>
                          )}
                        </div>

                        {/* Middle: 10-Day Stepper */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => {
                            const item = lead.cadence?.[`d${d}`];
                            const st = item?.status || 'Pendente';
                            const isNext = prog.nextPendingDay === d;
                            return (
                              <button
                                key={d}
                                onClick={() => toggleCadenceDay(lead.id, d)}
                                className={`px-2.5 py-2 rounded-xl text-xs font-bold flex flex-col items-center min-w-[52px] border transition cursor-pointer ${
                                  st === 'Feito'
                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                    : isNext
                                    ? 'bg-blue-600/25 border-blue-400 text-white ring-2 ring-blue-500/30'
                                    : st === 'Pulado'
                                    ? 'bg-slate-800/50 border-slate-700 text-slate-500 line-through'
                                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                              >
                                <span>D+{d}</span>
                                <span className="text-[9px] font-normal mt-0.5">
                                  {st === 'Feito' ? '✓ Feito' : isNext ? 'Hoje' : st}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Right: Quick Action */}
                        <div className="flex items-center gap-2 shrink-0">
                          {lead.phone && (
                            <a
                              href={getWhatsAppUrl(lead, prog.nextPendingDay || 1)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span>Cobrar D+{prog.nextPendingDay || 10} no WhatsApp</span>
                            </a>
                          )}
                          <button
                            onClick={() => setEditingLead(lead)}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                          >
                            Anotar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 3B: SUGESTÕES DE CONTATO ATIVO & PONTOS DE ATENÇÃO */}
        {activeTab === 'suggestions' && (
          <div className="space-y-5">
            {/* Header & Filter Pills */}
            <div className="bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Playbook Inteligente Autocar
                </span>
                <h2 className="text-base sm:text-lg font-bold text-white mt-1.5 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-emerald-400" />
                  Sugestões de Abordagem Ativa & Pontos de Atenção por Lead
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  O sistema lê automaticamente o que o vendedor preencheu (veículo, planos Básico/Master/Exclusivo, objeções, horário de chegada e cadência D+1..D+10) e gera os <strong>pontos de atenção</strong> + <strong>script pronto para WhatsApp/Ligação</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {[
                  { id: 'TODOS', label: 'Todos Ativos' },
                  { id: 'URGENTE HOJE', label: '🔥 Urgentes Hoje' },
                  { id: 'PROPOSTAS', label: '💰 Propostas em Aberto' },
                  { id: 'RESGATE_D10', label: '⚠️ Resgate Antes do D+10' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() =>
                      setSuggestionFilter(
                        f.id as 'TODOS' | 'URGENTE HOJE' | 'PROPOSTAS' | 'RESGATE_D10'
                      )
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      suggestionFilter === f.id
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/20'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cards List */}
            <div className="grid grid-cols-1 gap-4">
              {roleScopedLeads
                .filter((l) => l.stage !== 'Fechado')
                .map((lead) => ({
                  lead,
                  suggestion: generateLeadSuggestion(lead),
                  prog: getCadenceProgress(lead),
                }))
                .filter(({ lead, suggestion, prog }) => {
                  if (suggestionFilter === 'URGENTE HOJE') {
                    return suggestion.priorityLabel === 'URGENTE HOJE';
                  }
                  if (suggestionFilter === 'PROPOSTAS') {
                    return lead.stage === 'Proposta enviada' || lead.stage === 'Negociação';
                  }
                  if (suggestionFilter === 'RESGATE_D10') {
                    return prog.isPrematurelyLost || prog.isStaleOver3Days;
                  }
                  return true;
                })
                .sort((a, b) => b.suggestion.priorityScore - a.suggestion.priorityScore)
                .map(({ lead, suggestion, prog }) => (
                  <div
                    key={lead.id}
                    className={`bg-slate-900 border rounded-2xl p-5 transition shadow-lg ${
                      suggestion.priorityLabel === 'URGENTE HOJE'
                        ? 'border-amber-500/40'
                        : 'border-slate-800'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-800/80">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono text-slate-500">#{lead.number}</span>
                          <h3 className="text-base font-bold text-white">{lead.name}</h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              suggestion.priorityLabel === 'URGENTE HOJE'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : suggestion.priorityLabel === 'ALTA PRIORIDADE'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {suggestion.priorityLabel} · Score {suggestion.priorityScore}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-200">
                            Etapa: {lead.stage}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300">
                            Cadência: {suggestion.currentDayLabel}
                          </span>
                          {lead.vehicle && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300">
                              🚗 {lead.vehicle} ({suggestion.detectedContext.vehicleType})
                            </span>
                          )}
                          {lead.proposalValue ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400">
                              Proposta: R$ {lead.proposalValue.toFixed(2)}
                            </span>
                          ) : null}
                        </div>

                        <p className="text-xs text-slate-400">
                          Vendedora: <strong className="text-slate-200">{lead.seller}</strong> · Origem:{' '}
                          <strong className="text-slate-200">{lead.origin}</strong> · 1º Contato ≤5min:{' '}
                          <strong
                            className={
                              lead.contactUnder5Min === 'Sim' ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {lead.contactUnder5Min}
                          </strong>
                          {lead.mainObjection && (
                            <>
                              {' '}
                              · Objeção registrada:{' '}
                              <strong className="text-rose-300">{lead.mainObjection}</strong>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Recommended Channel Badge */}
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                            Canal Recomendado Hoje
                          </span>
                          <span className="text-xs font-bold text-emerald-400">
                            ⚡ {suggestion.recommendedChannel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Body Grid: Left = Pontos de Atenção + Anotações | Right = Estratégia + Script Pronto */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4">
                      {/* Left 5 cols: Pontos de Atenção & Contexto Coletado */}
                      <div className="lg:col-span-5 space-y-3">
                        <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            Pontos de Atenção Identificados no Lead
                          </h4>
                          <ul className="space-y-2 text-xs text-slate-200">
                            {suggestion.attentionPoints.map((pt, idx) => (
                              <li key={idx} className="flex items-start gap-2 leading-relaxed">
                                <span className="text-amber-400 font-bold">•</span>
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs space-y-1.5">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Informações Coletadas pelo Vendedor:
                          </span>
                          <p className="text-slate-300 italic">
                            {lead.notes ? `"${lead.notes}"` : 'Nenhuma observação detalhada preenchida ainda.'}
                          </p>
                          {lead.noResponseReason && (
                            <p className="text-slate-400 text-[11px]">
                              <strong>Histórico Follow-up:</strong> {lead.noResponseReason}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right 7 cols: Estratégia de Contato Ativo & Script */}
                      <div className="lg:col-span-7 flex flex-col justify-between bg-slate-950 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                              Como Fazer o Contato Ativo Agora
                            </span>
                            {suggestion.detectedContext.quotedPlans.length > 0 && (
                              <span className="text-[11px] text-slate-400">
                                Planos citados:{' '}
                                <strong className="text-white">
                                  {suggestion.detectedContext.quotedPlans.join(', ')}
                                </strong>
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-white">{suggestion.strategyTitle}</h4>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {suggestion.strategyExplanation}
                          </p>

                          {/* Script Box */}
                          <div className="mt-2 bg-slate-900 border border-slate-800 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-semibold uppercase text-emerald-400">
                                💬 Script Personalizado Sugerido:
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(suggestion.suggestedScript);
                                  setCopiedScriptId(lead.id);
                                  setTimeout(() => setCopiedScriptId(null), 2000);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                              >
                                {copiedScriptId === lead.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copiar Script</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="text-xs text-emerald-100 leading-relaxed font-medium">
                              {suggestion.suggestedScript}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                          <div className="flex items-center gap-2">
                            {lead.phone && (
                              <a
                                href={getWhatsAppUrl(
                                  lead,
                                  prog.nextPendingDay || 1,
                                  suggestion.suggestedScript
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition"
                              >
                                <MessageCircle className="w-4 h-4" />
                                <span>Enviar Script no WhatsApp Agora</span>
                              </a>
                            )}
                            <button
                              onClick={() =>
                                toggleCadenceDay(lead.id, prog.nextPendingDay || Math.min(10, prog.doneDays + 1))
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>
                                Marcar D+{prog.nextPendingDay || Math.min(10, prog.doneDays + 1)} como Feito
                              </span>
                            </button>
                          </div>

                          <button
                            onClick={() => setEditingLead(lead)}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                          >
                            Atualizar Anotações do Lead
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 4: KANBAN VIEW */}
        {activeTab === 'kanban' && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
            {STAGES_LIST.map((stage) => {
              const stageLeads = roleScopedLeads.filter((l) => l.stage === stage);
              return (
                <div
                  key={stage}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col min-h-[540px]"
                >
                  <div className="flex items-center justify-between px-2 py-1.5 mb-3 border-b border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">{stage}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-blue-400">
                      {stageLeads.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {stageLeads.map((lead) => {
                      const prog = getCadenceProgress(lead);
                      return (
                        <div
                          key={lead.id}
                          className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3 space-y-2 shadow-sm transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-white">{lead.name}</h4>
                              <span className="text-[10px] text-slate-400 block">{lead.vehicle || lead.origin}</span>
                            </div>
                            {lead.proposalValue && (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                R${lead.proposalValue}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Cadência: {prog.doneDays}/10 dias</span>
                            <span>{lead.seller}</span>
                          </div>

                          <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-900">
                            <a
                              href={getWhatsAppUrl(lead)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:underline font-medium"
                            >
                              <MessageCircle className="w-3 h-3" /> WhatsApp
                            </a>
                            <select
                              value={lead.stage}
                              onChange={(e) => updateLeadField(lead.id, 'stage', e.target.value)}
                              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-300"
                            >
                              {STAGES_LIST.map((s) => (
                                <option key={s} value={s}>
                                  Mover: {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 5: SERVIDOR MCP & INTEGRAÇÃO CLAUDE */}
        {activeTab === 'mcp' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Model Context Protocol (MCP) Ready
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-white mt-2">
                    Servidor MCP Autocar CRM para Claude Desktop / Claude Code
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Vincule o CRM diretamente ao Claude para que ele audite as vendedoras, identifique gargalos na cadência D+1..D+10 e envie feedbacks automáticos para a tela de cada vendedora.
                  </p>
                </div>
                <button
                  onClick={() => generateSmartMcpFeedback(selectedSellerFilter)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-purple-600/25 transition cursor-pointer shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Disparar Auditoria & Feedback Automático Agora</span>
                </button>
              </div>

              {/* MCP Tools List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {[
                  {
                    name: 'get_crm_dashboard_summary',
                    desc: 'Lê todas as taxas de conversão, velocidade ≤5min, qualificação e receita por vendedora.',
                  },
                  {
                    name: 'get_diagnostic_failures_and_positives',
                    desc: 'Retorna os pontos de falha (ex: 0% em Tráfego Pago, descarte antes do D+10) e pontos positivos.',
                  },
                  {
                    name: 'list_leads_needing_followup_d1_to_d10',
                    desc: 'Lista todos os leads ativos na cadência de 10 dias e quem precisa ser cobrado hoje.',
                  },
                  {
                    name: 'send_automated_feedback_to_seller',
                    desc: 'Publica um alerta/feedback direto no topo da tela da vendedora (Anne, João, Tainá, etc.).',
                  },
                  {
                    name: 'update_lead_followup_or_stage',
                    desc: 'Marca dias D+1..D+10 como feitos ou adiciona observações estratégicas nos leads pelo Claude.',
                  },
                ].map((tool) => (
                  <div key={tool.name} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <code className="text-xs font-bold text-purple-400 block mb-1">{tool.name}</code>
                    <p className="text-xs text-slate-400">{tool.desc}</p>
                  </div>
                ))}
              </div>

              {/* Claude Desktop Config Snippet */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Configuração para <code className="text-purple-300">claude_desktop_config.json</code>:
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(
                          {
                            mcpServers: {
                              'autocar-crm': {
                                command: 'node',
                                args: ['C:\\Users\\Vitor\\.gemini\\antigravity\\scratch\\autocar-crm\\mcp-server\\index.mjs'],
                                env: {
                                  CRM_API_URL: 'http://localhost:3000/api/mcp',
                                },
                              },
                            },
                          },
                          null,
                          2
                        )
                      );
                      setCopiedConfig(true);
                      setTimeout(() => setCopiedConfig(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                  >
                    {copiedConfig ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedConfig ? 'Copiado!' : 'Copiar JSON'}</span>
                  </button>
                </div>
                <pre className="text-xs text-emerald-300 overflow-x-auto font-mono leading-relaxed">
{`{
  "mcpServers": {
    "autocar-crm": {
      "command": "node",
      "args": [
        "C:\\\\Users\\\\Vitor\\\\.gemini\\\\antigravity\\\\scratch\\\\autocar-crm\\\\mcp-server\\\\index.mjs"
      ],
      "env": {
        "CRM_API_URL": "http://localhost:3000/api/mcp"
      }
    }
  }
}`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: NOVO LEAD */}
      {isNewLeadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Cadastrar Novo Lead</h3>
              <button onClick={() => setIsNewLeadModalOpen(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateLead} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Nome do Lead *</label>
                  <input
                    required
                    value={newLeadForm.name}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    placeholder="Ex: Carlos Eduardo"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Telefone / WhatsApp *</label>
                  <input
                    required
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    placeholder="(81) 99999-9999"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Carro / Modelo</label>
                  <input
                    value={newLeadForm.vehicle}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, vehicle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    placeholder="Ex: Onix / Fan 160"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Origem</label>
                  <select
                    value={newLeadForm.origin}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, origin: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    {ORIGINS_LIST.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">1º Contato ≤ 5 min?</label>
                  <select
                    value={newLeadForm.contactUnder5Min}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, contactUnder5Min: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Sim">Sim (Janela de Ouro)</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Valor da Proposta (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newLeadForm.proposalValue}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, proposalValue: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    placeholder="Ex: 115.00"
                  />
                </div>
                {currentUser.role === 'admin' && (
                  <div className="sm:col-span-2">
                    <label className="text-slate-400 block mb-1">Vendedora Responsável</label>
                    <select
                      value={newLeadForm.seller}
                      onChange={(e) => setNewLeadForm({ ...newLeadForm, seller: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      {SELLERS_LIST.filter((s) => s.role === 'seller').map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Observações da Tratativa</label>
                <textarea
                  rows={3}
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  placeholder="Anote detalhes da cotação (Básico, Master, Exclusivo) ou horário de chegada..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewLeadModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                  Salvar Lead + Iniciar D+1
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR LEAD */}
      {editingLead && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Editar Lead: {editingLead.name}</h3>
              <button onClick={() => setEditingLead(null)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditedLead} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Nome</label>
                  <input
                    value={editingLead.name}
                    onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Telefone</label>
                  <input
                    value={editingLead.phone}
                    onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Veículo</label>
                  <input
                    value={editingLead.vehicle}
                    onChange={(e) => setEditingLead({ ...editingLead, vehicle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Valor Proposta (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingLead.proposalValue ?? ''}
                    onChange={(e) =>
                      setEditingLead({
                        ...editingLead,
                        proposalValue: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Canal Preferencial</label>
                  <select
                    value={editingLead.channel}
                    onChange={(e) => setEditingLead({ ...editingLead, channel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    {CHANNELS_LIST.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Vendedora</label>
                  <select
                    value={editingLead.seller}
                    onChange={(e) => setEditingLead({ ...editingLead, seller: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    {SELLERS_LIST.filter((s) => s.role === 'seller').map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Observações / Histórico de Cotações</label>
                <textarea
                  rows={4}
                  value={editingLead.notes}
                  onChange={(e) => setEditingLead({ ...editingLead, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ENVIAR FEEDBACK MANUAL */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Enviar Feedback para Vendedor(a)</h3>
              <button onClick={() => setIsFeedbackModalOpen(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>
            <form onSubmit={handleSendFeedback} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Vendedora Destino</label>
                <select
                  value={feedbackForm.targetSeller}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, targetSeller: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="Todos">Toda a Equipe Comercial</option>
                  {SELLERS_LIST.filter((s) => s.role === 'seller').map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Prioridade / Tipo</label>
                <select
                  value={feedbackForm.severity}
                  onChange={(e) =>
                    setFeedbackForm({
                      ...feedbackForm,
                      severity: e.target.value as 'positivo' | 'atencao' | 'critico',
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="positivo">🟢 Ponto Positivo / Elogio</option>
                  <option value="atencao">🟡 Ponto de Atenção / Orientação</option>
                  <option value="critico">🔴 Gargalo Crítico / Correção de Cadência</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Título</label>
                <input
                  required
                  value={feedbackForm.title}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  placeholder="Ex: Atenção aos leads de Tráfego Pago no D+3"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Mensagem / Ação Recomendada</label>
                <textarea
                  required
                  rows={3}
                  value={feedbackForm.message}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  placeholder="Descreva os pontos identificados e o que deve ser feito hoje..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFeedbackModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold">
                  Publicar Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
