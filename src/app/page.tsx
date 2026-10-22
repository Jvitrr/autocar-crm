'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Plus,
  Search,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Upload,
  Send,
  Check,
  Copy,
  Edit3,
  Lightbulb,
  BarChart3,
  Cpu,
  Users,
  Clock,
  TrendingUp,
  CalendarCheck,
  ChevronRight,
  LayoutGrid,
  ListFilter,
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

  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('Todos');

  // Clean 4-Tab Navigation
  const [activeTab, setActiveTab] = useState<'leads' | 'suggestions' | 'dashboard' | 'mcp'>('leads');
  const [leadsViewMode, setLeadsViewMode] = useState<'table' | 'kanban'>('table');
  const [suggestionFilter, setSuggestionFilter] = useState<'TODOS' | 'URGENTE HOJE' | 'PROPOSTAS' | 'RESGATE_D10'>('TODOS');
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);
  const [copiedConfig, setCopiedConfig] = useState(false);

  // Data State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [feedbacks, setFeedbacks] = useState<SellerFeedback[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('Todas');
  const [onlyPendingFollowup, setOnlyPendingFollowup] = useState(false);

  // Modals & Drawer State
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // New Lead Form
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

  // Feedback Form
  const [feedbackForm, setFeedbackForm] = useState({
    targetSeller: 'Anne',
    severity: 'atencao' as 'positivo' | 'atencao' | 'critico',
    title: '',
    message: '',
    author: 'Gestor',
  });

  useEffect(() => {
    async function fetchData() {
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
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (currentUser.role === 'seller') {
      setSelectedSellerFilter(currentUser.name);
      if (activeTab === 'mcp') setActiveTab('leads');
    } else {
      setSelectedSellerFilter('Todos');
    }
  }, [currentUser, activeTab]);

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
      // local fallback
    }
  };

  const syncFeedbacks = async (updated: SellerFeedback[]) => {
    setFeedbacks(updated);
    localStorage.setItem('autocar_crm_fb_v1', JSON.stringify(updated));
  };

  const roleScopedLeads = useMemo(() => {
    if (currentUser.role === 'seller') {
      return leads.filter((l) => l.seller.toLowerCase() === currentUser.name.toLowerCase());
    }
    if (selectedSellerFilter !== 'Todos') {
      return leads.filter((l) => l.seller.toLowerCase() === selectedSellerFilter.toLowerCase());
    }
    return leads;
  }, [leads, currentUser, selectedSellerFilter]);

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
      if (!matchSearch || !matchStage) return false;

      if (onlyPendingFollowup) {
        const prog = getCadenceProgress(l);
        return l.stage !== 'Fechado' && l.stage !== 'Perdido' && prog.doneDays < 10;
      }
      return true;
    });
  }, [roleScopedLeads, searchQuery, stageFilter, onlyPendingFollowup]);

  const analytics = useMemo(() => computeAnalytics(roleScopedLeads), [roleScopedLeads]);
  const globalAnalytics = useMemo(() => computeAnalytics(leads), [leads]);

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
        current.status === 'Pendente' ? 'Feito' : current.status === 'Feito' ? 'Pulado' : 'Pendente';

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

  const handleSaveEditedLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    const updated = leads.map((l) => (l.id === editingLead.id ? editingLead : l));
    syncLeads(updated);
    setEditingLead(null);
  };

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

  const generateSmartMcpFeedback = async (sellerName: string) => {
    const sellerLeads = leads.filter((l) => sellerName === 'Todos' || l.seller === sellerName);
    const stats = computeAnalytics(sellerLeads);
    const openProposals = sellerLeads
      .filter((l) => l.stage === 'Proposta enviada')
      .map((l) => l.name)
      .slice(0, 4)
      .join(', ');

    const newFb: SellerFeedback = {
      id: `fb-${Date.now()}`,
      createdAt: new Date().toISOString(),
      targetSeller: sellerName === 'Todos' ? 'Anne' : sellerName,
      author: 'Claude MCP',
      severity: stats.prematureLostCount > 0 ? 'critico' : 'atencao',
      title: `Prioridade do Dia: Propostas & Cadência D+10`,
      message: `Conversão em ${stats.conversionRate.toFixed(1)}% (${stats.closedCount} fechados). Focar hoje nas propostas abertas (${openProposals || 'em andamento'}) e completar os 10 dias de follow-up antes de encerrar leads.`,
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
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
        alert(`${imported.length} leads importados com sucesso!`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const latestFeedback = visibleFeedbacks[0];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-yellow-400 selection:text-black">
      {/* PREMIUM BLACK & GOLD HEADER */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-18 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-400/20">
              <Shield className="w-5 h-5 text-black fill-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">
                  AUTOCAR <span className="text-yellow-400">CRM</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 hidden sm:block">Gestão Comercial & Cadência D+10</p>
            </div>
          </div>

          {/* Center Navigation Pills */}
          <nav className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-2xl border border-zinc-800">
            <button
              onClick={() => setActiveTab('leads')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'leads'
                  ? 'bg-yellow-400 text-black shadow-md shadow-yellow-400/10'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Leads & Follow-up</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'leads' ? 'bg-black/15 text-black' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {roleScopedLeads.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('suggestions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'suggestions'
                  ? 'bg-yellow-400 text-black shadow-md shadow-yellow-400/10'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              <span>Contato Ativo (IA)</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-yellow-400 text-black shadow-md shadow-yellow-400/10'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('mcp')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'mcp'
                  ? 'bg-yellow-400 text-black shadow-md shadow-yellow-400/10'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span className="hidden md:inline">Claude MCP</span>
            </button>
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5">
            {/* Profile Selector */}
            <select
              value={currentUserId}
              onChange={(e) => setCurrentUserId(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-yellow-400 cursor-pointer"
            >
              {SELLERS_LIST.map((u) => (
                <option key={u.id} value={u.id} className="bg-zinc-950 text-white">
                  {u.role === 'admin' ? `👑 Admin / Gestor` : `👤 ${u.name}`}
                </option>
              ))}
            </select>

            {/* Seller Filter for Admin */}
            {currentUser.role === 'admin' && (
              <select
                value={selectedSellerFilter}
                onChange={(e) => setSelectedSellerFilter(e.target.value)}
                className="hidden xl:block bg-zinc-900 border border-zinc-800 text-xs font-semibold text-yellow-400 rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer"
              >
                <option value="Todos" className="bg-zinc-950 text-white">
                  Equipe Completa
                </option>
                {SELLERS_LIST.filter((s) => s.role === 'seller').map((s) => (
                  <option key={s.id} value={s.name} className="bg-zinc-950 text-white">
                    Vendedora: {s.name}
                  </option>
                ))}
              </select>
            )}

            {/* New Lead CTA */}
            <button
              onClick={() => setIsNewLeadModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-extrabold tracking-wide shadow-lg shadow-yellow-400/15 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Novo Lead</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* SLIM FEEDBACK BAR (1-LINE CLEAN ALERT) */}
        {latestFeedback && (
          <div className="bg-zinc-900/90 border border-yellow-400/25 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-2 py-0.5 rounded-md bg-yellow-400 text-black text-[10px] font-extrabold uppercase shrink-0">
                {latestFeedback.author} → {latestFeedback.targetSeller}
              </span>
              <p className="text-xs text-zinc-200 truncate">
                <strong className="text-white mr-1.5">{latestFeedback.title}:</strong>
                <span className="text-zinc-400">{latestFeedback.message}</span>
              </p>
            </div>
            {currentUser.role === 'admin' && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => generateSmartMcpFeedback(selectedSellerFilter)}
                  className="text-[11px] font-bold text-yellow-400 hover:text-yellow-300 flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Atualizar IA
                </button>
                <span className="text-zinc-700">|</span>
                <button
                  onClick={() => setIsFeedbackModalOpen(true)}
                  className="text-[11px] font-semibold text-zinc-400 hover:text-white cursor-pointer"
                >
                  + Novo Aviso
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 1: LEADS & FOLLOW-UP (UNIFIED, CLEAN, INTUITIVE)
           =================================================================== */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            {/* Quick Summary Strip + Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3">
              {/* Search & Stage Pills */}
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative min-w-[240px] flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar cliente, carro ou telefone..."
                    className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-yellow-400"
                  />
                </div>

                {/* Stage Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                  {['Todas', ...STAGES_LIST].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStageFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        stageFilter === st
                          ? 'bg-yellow-400 text-black font-bold'
                          : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right View Toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOnlyPendingFollowup(!onlyPendingFollowup)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    onlyPendingFollowup
                      ? 'bg-yellow-400/15 border-yellow-400 text-yellow-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  🔁 Pendentes D+10
                </button>

                <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-0.5">
                  <button
                    onClick={() => setLeadsViewMode('table')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      leadsViewMode === 'table' ? 'bg-zinc-800 text-yellow-400' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Lista
                  </button>
                  <button
                    onClick={() => setLeadsViewMode('kanban')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      leadsViewMode === 'kanban' ? 'bg-zinc-800 text-yellow-400' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Kanban
                  </button>
                </div>

                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition">
                  <Upload className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="hidden sm:inline">Importar</span>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* TABLE VIEW (CLEAN 7-COLUMN LAYOUT) */}
            {leadsViewMode === 'table' ? (
              <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-zinc-950/90 border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
                        <th className="py-3.5 px-4">Cliente & Veículo</th>
                        <th className="py-3.5 px-3">Etapa do Funil</th>
                        <th className="py-3.5 px-3">Qualificado</th>
                        <th className="py-3.5 px-3">Cadência Diária (D+1 até D+10)</th>
                        <th className="py-3.5 px-3">Valor / Objeção</th>
                        <th className="py-3.5 px-4 text-right">Ação Rápida</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {visibleLeads.map((lead) => {
                        const prog = getCadenceProgress(lead);
                        return (
                          <tr key={lead.id} className="hover:bg-zinc-800/30 transition">
                            {/* 1. Cliente & Veículo */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-yellow-400 text-xs shrink-0">
                                  {lead.number}
                                </div>
                                <div>
                                  <div className="font-bold text-white text-sm flex items-center gap-2">
                                    <span>{lead.name}</span>
                                    {lead.contactUnder5Min === 'Sim' && (
                                      <span
                                        className="text-[10px] px-1.5 py-0.2 rounded bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 font-semibold"
                                        title="Atendido em até 5 minutos"
                                      >
                                        ⚡ ≤5m
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                                    <span>{lead.vehicle ? `🚗 ${lead.vehicle}` : 'Sem veículo'}</span>
                                    <span>·</span>
                                    <span>{lead.origin}</span>
                                    <span>·</span>
                                    <span className="text-zinc-500">{lead.phone}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 2. Etapa */}
                            <td className="py-3.5 px-3">
                              <select
                                value={lead.stage}
                                onChange={(e) => updateLeadField(lead.id, 'stage', e.target.value)}
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold border focus:outline-none cursor-pointer ${
                                  lead.stage === 'Fechado'
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : lead.stage === 'Perdido'
                                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                    : lead.stage === 'Proposta enviada'
                                    ? 'bg-yellow-400/15 text-yellow-300 border-yellow-400/40'
                                    : 'bg-zinc-950 text-zinc-200 border-zinc-800'
                                }`}
                              >
                                {STAGES_LIST.map((s) => (
                                  <option key={s} value={s} className="bg-zinc-950 text-white">
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* 3. Qualificado */}
                            <td className="py-3.5 px-3">
                              <select
                                value={lead.qualified}
                                onChange={(e) => updateLeadField(lead.id, 'qualified', e.target.value)}
                                className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold border focus:outline-none cursor-pointer ${
                                  lead.qualified === 'Sim'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                    : lead.qualified === 'Não'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                                    : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                                }`}
                              >
                                <option value="Sim" className="bg-zinc-950 text-white">
                                  Sim
                                </option>
                                <option value="A verificar" className="bg-zinc-950 text-white">
                                  A verificar
                                </option>
                                <option value="Não" className="bg-zinc-950 text-white">
                                  Não
                                </option>
                              </select>
                            </td>

                            {/* 4. Cadência D+1..D+10 */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => {
                                  const st = lead.cadence?.[`d${d}`]?.status || 'Pendente';
                                  const isNext = prog.nextPendingDay === d && lead.stage !== 'Fechado';
                                  return (
                                    <button
                                      key={d}
                                      onClick={() => toggleCadenceDay(lead.id, d)}
                                      title={`Dia ${d}: ${st}`}
                                      className={`w-6 h-6 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                                        st === 'Feito'
                                          ? 'bg-yellow-400 text-black shadow-sm shadow-yellow-400/20'
                                          : isNext
                                          ? 'bg-zinc-950 text-yellow-400 border-2 border-yellow-400'
                                          : st === 'Pulado'
                                          ? 'bg-zinc-800/50 text-zinc-600 line-through'
                                          : 'bg-zinc-950 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                                      }`}
                                    >
                                      {d}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[10px]">
                                <span className="text-zinc-500">{prog.doneDays}/10 dias concluídos</span>
                                {prog.isPrematurelyLost && (
                                  <span className="text-rose-400 font-semibold">· Parou antes do D+10</span>
                                )}
                              </div>
                            </td>

                            {/* 5. Valor / Objeção */}
                            <td className="py-3.5 px-3">
                              <div className="font-bold text-white text-xs">
                                {lead.proposalValue ? `R$ ${lead.proposalValue.toFixed(2)}` : 'Sem valor'}
                              </div>
                              <div className="text-[11px] text-zinc-500 truncate max-w-[160px]">
                                {lead.mainObjection || lead.notes || 'Sem objeção'}
                              </div>
                            </td>

                            {/* 6. Ações Rápidas */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {lead.phone && (
                                  <a
                                    href={getWhatsAppUrl(lead, prog.nextPendingDay || undefined)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5 fill-black" />
                                    <span>WhatsApp</span>
                                  </a>
                                )}
                                <button
                                  onClick={() => setEditingLead(lead)}
                                  className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                                  title="Ver detalhes e anotações"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* KANBAN VIEW */
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {STAGES_LIST.map((stage) => {
                  const stageLeads = visibleLeads.filter((l) => l.stage === stage);
                  return (
                    <div
                      key={stage}
                      className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-3 flex flex-col min-h-[480px]"
                    >
                      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-zinc-800">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-200">{stage}</span>
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-yellow-400/15 text-yellow-400">
                          {stageLeads.length}
                        </span>
                      </div>
                      <div className="space-y-2.5 flex-1">
                        {stageLeads.map((lead) => {
                          const prog = getCadenceProgress(lead);
                          return (
                            <div
                              key={lead.id}
                              onClick={() => setEditingLead(lead)}
                              className="bg-zinc-950 border border-zinc-800/90 hover:border-yellow-400/50 rounded-xl p-3 space-y-2 cursor-pointer transition"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-xs font-bold text-white">{lead.name}</h4>
                                {lead.proposalValue && (
                                  <span className="text-[10px] font-bold text-yellow-400">R${lead.proposalValue}</span>
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-400">{lead.vehicle || lead.origin}</p>
                              <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-[10px] text-zinc-500">
                                <span>D+{prog.doneDays}/10</span>
                                <a
                                  href={getWhatsAppUrl(lead)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-emerald-400 font-bold hover:underline"
                                >
                                  WhatsApp →
                                </a>
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
          </div>
        )}

        {/* ===================================================================
            TAB 2: CONTATO ATIVO & PONTOS DE ATENÇÃO (SIMPLIFIED & DIRECT)
           =================================================================== */}
        {activeTab === 'suggestions' && (
          <div className="space-y-5">
            {/* Simple Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-400" />
                  Guia de Contato Ativo & Pontos de Atenção
                </h2>
                <p className="text-xs text-zinc-400">
                  Recomendações diretas geradas a partir do preenchimento de cada lead.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'TODOS', label: 'Todos' },
                  { id: 'URGENTE HOJE', label: '🔥 Urgentes' },
                  { id: 'PROPOSTAS', label: '💰 Propostas Abertas' },
                  { id: 'RESGATE_D10', label: '⚠️ Resgate D+10' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() =>
                      setSuggestionFilter(f.id as 'TODOS' | 'URGENTE HOJE' | 'PROPOSTAS' | 'RESGATE_D10')
                    }
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      suggestionFilter === f.id
                        ? 'bg-yellow-400 text-black'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clean 2-Column Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roleScopedLeads
                .filter((l) => l.stage !== 'Fechado')
                .map((lead) => ({
                  lead,
                  suggestion: generateLeadSuggestion(lead),
                  prog: getCadenceProgress(lead),
                }))
                .filter(({ lead, suggestion, prog }) => {
                  if (suggestionFilter === 'URGENTE HOJE') return suggestion.priorityLabel === 'URGENTE HOJE';
                  if (suggestionFilter === 'PROPOSTAS')
                    return lead.stage === 'Proposta enviada' || lead.stage === 'Negociação';
                  if (suggestionFilter === 'RESGATE_D10') return prog.isPrematurelyLost || prog.isStaleOver3Days;
                  return true;
                })
                .sort((a, b) => b.suggestion.priorityScore - a.suggestion.priorityScore)
                .map(({ lead, suggestion, prog }) => (
                  <div
                    key={lead.id}
                    className="bg-zinc-900/80 border border-zinc-800 hover:border-yellow-400/40 rounded-2xl p-5 flex flex-col justify-between gap-4 transition"
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-extrabold text-white">{lead.name}</h3>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-yellow-400 text-black">
                              {suggestion.currentDayLabel}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {lead.vehicle ? `🚗 ${lead.vehicle}` : 'Veículo não informado'} · {lead.stage}
                            {lead.proposalValue ? ` · R$ ${lead.proposalValue.toFixed(2)}` : ''}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-bold text-yellow-400">
                          {suggestion.recommendedChannel}
                        </span>
                      </div>

                      {/* Ponto de Atenção (Concise) */}
                      <div className="bg-zinc-950 border-l-2 border-yellow-400 rounded-r-xl p-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-yellow-400 block mb-1">
                          ⚠️ Ponto de Atenção
                        </span>
                        <p className="text-xs text-zinc-200 leading-relaxed">{suggestion.attentionPoints[0]}</p>
                      </div>

                      {/* Script Sugerido */}
                      <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-zinc-400">
                            💬 {suggestion.strategyTitle}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(suggestion.suggestedScript);
                              setCopiedScriptId(lead.id);
                              setTimeout(() => setCopiedScriptId(null), 2000);
                            }}
                            className="text-[11px] text-yellow-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            {copiedScriptId === lead.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedScriptId === lead.id ? 'Copiado' : 'Copiar'}</span>
                          </button>
                        </div>
                        <p className="text-xs text-zinc-100 leading-relaxed">{suggestion.suggestedScript}</p>
                      </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/60">
                      <a
                        href={getWhatsAppUrl(lead, prog.nextPendingDay || 1, suggestion.suggestedScript)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-extrabold transition"
                      >
                        <MessageCircle className="w-4 h-4 fill-black" />
                        <span>Enviar no WhatsApp</span>
                      </a>
                      <button
                        onClick={() =>
                          toggleCadenceDay(lead.id, prog.nextPendingDay || Math.min(10, prog.doneDays + 1))
                        }
                        className="px-3.5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-bold cursor-pointer"
                      >
                        ✓ Feito D+{prog.nextPendingDay || Math.min(10, prog.doneDays + 1)}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: DASHBOARD & DIAGNÓSTICO (CLEAN EXECUTIVE VIEW)
           =================================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 4 Clean KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
                <span className="text-[11px] font-bold uppercase text-zinc-400">Total de Leads</span>
                <div className="text-3xl font-extrabold text-white mt-1">{analytics.total}</div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Qualificados: {analytics.qualifiedRate.toFixed(0)}%</span>
                  <span className="text-yellow-400 font-bold">Meta &gt; 60%</span>
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
                <span className="text-[11px] font-bold uppercase text-zinc-400">Contato em ≤ 5 min</span>
                <div className="text-3xl font-extrabold text-yellow-400 mt-1">
                  {analytics.fastContactRate.toFixed(1)}%
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{analytics.fastContactSim} no prazo</span>
                  <span className="text-zinc-300 font-bold">Meta ≥ 70%</span>
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
                <span className="text-[11px] font-bold uppercase text-zinc-400">Conversão (Fechados)</span>
                <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                  {analytics.conversionRate.toFixed(1)}%
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{analytics.closedCount} associados</span>
                  <span className="text-emerald-400 font-bold">R$ {analytics.totalRevenue.toFixed(0)}/mês</span>
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
                <span className="text-[11px] font-bold uppercase text-zinc-400">Cadência D+10</span>
                <div className="text-3xl font-extrabold text-white mt-1">
                  {analytics.avgFollowupDays.toFixed(1)} <span className="text-sm font-normal text-zinc-500">dias</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-rose-400">{analytics.prematureLostCount} pararam cedo</span>
                  <span className="text-yellow-400 font-bold">Meta: 10 dias</span>
                </div>
              </div>
            </div>

            {/* Pontos de Falha e Positivos (Clean Side-by-Side) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics.findings.map((f) => (
                <div
                  key={f.id}
                  className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex items-start gap-4"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      f.type === 'positivo'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : f.type === 'falha'
                        ? 'bg-rose-500/15 text-rose-400'
                        : 'bg-yellow-400/15 text-yellow-400'
                    }`}
                  >
                    {f.type === 'positivo' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : f.type === 'falha' ? (
                      <XCircle className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-white">{f.title}</span>
                      <span className="text-[11px] font-bold text-yellow-400">({f.currentValue})</span>
                    </div>
                    <p className="text-xs text-zinc-400">{f.description}</p>
                    <p className="text-xs text-zinc-200 pt-1">
                      <strong className="text-yellow-400">Ação:</strong> {f.actionableAdvice}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Equipe & Funil */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Funil 5 Cols */}
              <div className="lg:col-span-5 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Funil por Etapa</h3>
                {STAGES_LIST.map((stage) => {
                  const count = analytics.stageCounts[stage] || 0;
                  const pct = analytics.total > 0 ? (count / analytics.total) * 100 : 0;
                  return (
                    <div key={stage} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-200 font-medium">{stage}</span>
                        <span className="text-zinc-400 font-bold">
                          {count} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ranking Vendedoras 7 Cols */}
              <div className="lg:col-span-7 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 mb-3">
                  Desempenho por Vendedora
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500">
                        <th className="py-2">Vendedora</th>
                        <th className="py-2 text-center">Leads</th>
                        <th className="py-2 text-center">≤5 min</th>
                        <th className="py-2 text-center">Fechados</th>
                        <th className="py-2 text-right">Conversão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {globalAnalytics.sellerStats.map((s) => (
                        <tr key={s.seller}>
                          <td className="py-2.5 font-bold text-white">{s.seller}</td>
                          <td className="py-2.5 text-center text-zinc-300">{s.total}</td>
                          <td className="py-2.5 text-center text-zinc-300">{s.fastRate.toFixed(0)}%</td>
                          <td className="py-2.5 text-center font-bold text-yellow-400">{s.closed}</td>
                          <td className="py-2.5 text-right font-bold text-emerald-400">
                            {s.conversionRate.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 4: CLAUDE MCP INTEGRATION
           =================================================================== */}
        {activeTab === 'mcp' && (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-white">Conexão Claude MCP</h2>
                <p className="text-xs text-zinc-400">
                  Cole a configuração abaixo no seu <code className="text-yellow-400">claude_desktop_config.json</code> para automatizar feedbacks e auditorias.
                </p>
              </div>
              <button
                onClick={() => generateSmartMcpFeedback(selectedSellerFilter)}
                className="px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-extrabold cursor-pointer"
              >
                Disparar Feedback IA Agora
              </button>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-zinc-400">JSON de Configuração MCP</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(
                        {
                          mcpServers: {
                            'autocar-crm': {
                              command: 'node',
                              args: [
                                'C:\\Users\\Vitor\\.gemini\\antigravity\\scratch\\autocar-crm\\mcp-server\\index.mjs',
                              ],
                              env: { CRM_API_URL: 'http://localhost:3000/api/mcp' },
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
                  className="text-xs font-bold text-yellow-400 hover:underline cursor-pointer"
                >
                  {copiedConfig ? '✓ Copiado' : 'Copiar JSON'}
                </button>
              </div>
              <pre className="text-xs text-yellow-400/90 font-mono overflow-x-auto">
{`{
  "mcpServers": {
    "autocar-crm": {
      "command": "node",
      "args": ["C:\\\\Users\\\\Vitor\\\\.gemini\\\\antigravity\\\\scratch\\\\autocar-crm\\\\mcp-server\\\\index.mjs"],
      "env": { "CRM_API_URL": "http://localhost:3000/api/mcp" }
    }
  }
}`}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: NOVO LEAD */}
      {isNewLeadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Novo Lead</h3>
              <button onClick={() => setIsNewLeadModalOpen(false)} className="text-zinc-400 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateLead} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Nome *</label>
                  <input
                    required
                    value={newLeadForm.name}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:border-yellow-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">WhatsApp *</label>
                  <input
                    required
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:border-yellow-400 focus:outline-none"
                    placeholder="(81) 99999-9999"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Carro / Moto</label>
                  <input
                    value={newLeadForm.vehicle}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, vehicle: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:border-yellow-400 focus:outline-none"
                    placeholder="Ex: Onix / Fan 160"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Origem</label>
                  <select
                    value={newLeadForm.origin}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, origin: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  >
                    {ORIGINS_LIST.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Atendido em ≤ 5 min?</label>
                  <select
                    value={newLeadForm.contactUnder5Min}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, contactUnder5Min: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Valor Proposta (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newLeadForm.proposalValue}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, proposalValue: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">Observações</label>
                <textarea
                  rows={3}
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  placeholder="Planos cotados, dúvidas ou detalhes do lead..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewLeadModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold"
                >
                  Salvar Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR DETALHES DO LEAD */}
      {editingLead && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Detalhes: {editingLead.name}</h3>
              <button onClick={() => setEditingLead(null)} className="text-zinc-400 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditedLead} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Nome</label>
                  <input
                    value={editingLead.name}
                    onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Telefone</label>
                  <input
                    value={editingLead.phone}
                    onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Veículo</label>
                  <input
                    value={editingLead.vehicle}
                    onChange={(e) => setEditingLead({ ...editingLead, vehicle: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Proposta (R$)</label>
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
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Principal Objeção</label>
                  <select
                    value={editingLead.mainObjection || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, mainObjection: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="">Sem objeção</option>
                    {OBJECTIONS_LIST.filter((o) => o !== '').map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Vendedora</label>
                  <select
                    value={editingLead.seller}
                    onChange={(e) => setEditingLead({ ...editingLead, seller: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
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
                <label className="text-zinc-400 block mb-1">Anotações do Vendedor</label>
                <textarea
                  rows={4}
                  value={editingLead.notes}
                  onChange={(e) => setEditingLead({ ...editingLead, notes: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO AVISO / FEEDBACK */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Enviar Aviso para Vendedora</h3>
              <button onClick={() => setIsFeedbackModalOpen(false)} className="text-zinc-400 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleSendFeedback} className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Vendedora</label>
                <select
                  value={feedbackForm.targetSeller}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, targetSeller: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="Todos">Toda a Equipe</option>
                  {SELLERS_LIST.filter((s) => s.role === 'seller').map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">Título Curto</label>
                <input
                  required
                  value={feedbackForm.title}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, title: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">Orientação Direta</label>
                <textarea
                  required
                  rows={3}
                  value={feedbackForm.message}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFeedbackModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold"
                >
                  Publicar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
