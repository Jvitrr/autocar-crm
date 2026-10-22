import { Lead } from '@/types/crm';

export interface DiagnosticFinding {
  id: string;
  type: 'positivo' | 'falha' | 'alerta';
  metric: string;
  currentValue: string;
  targetValue: string;
  title: string;
  description: string;
  actionableAdvice: string;
  affectedLeadsCount?: number;
}

export function getCadenceProgress(lead: Lead): {
  doneDays: number;
  maxDayReached: number;
  nextPendingDay: number | null;
  daysSinceEntry: number;
  isStaleOver3Days: boolean;
  isPrematurelyLost: boolean;
} {
  const cadence = lead.cadence || {};
  let doneDays = 0;
  let maxDayReached = 0;
  let nextPendingDay: number | null = null;
  let lastContactDateStr = lead.firstContactDate || lead.entryDate;

  for (let d = 1; d <= 10; d++) {
    const item = cadence[`d${d}`];
    if (item?.status === 'Feito') {
      doneDays++;
      maxDayReached = d;
      if (item.date && item.date > (lastContactDateStr || '')) {
        lastContactDateStr = item.date;
      }
    } else if (item?.status === 'Pendente' && nextPendingDay === null) {
      nextPendingDay = d;
    }
  }

  const refToday = new Date('2026-10-22T12:00:00-03:00');
  const entryDt = new Date((lead.entryDate || '2026-10-22') + 'T12:00:00-03:00');
  const lastDt = new Date((lastContactDateStr || lead.entryDate || '2026-10-22') + 'T12:00:00-03:00');

  const daysSinceEntry = Math.max(0, Math.floor((refToday.getTime() - entryDt.getTime()) / (1000 * 60 * 60 * 24)));
  const daysSinceLastContact = Math.max(0, Math.floor((refToday.getTime() - lastDt.getTime()) / (1000 * 60 * 60 * 24)));

  const isActive = lead.stage !== 'Fechado' && lead.stage !== 'Perdido' && lead.result !== 'Fechado' && lead.result !== 'Perdido';
  const isStaleOver3Days = isActive && daysSinceLastContact > 3;

  // Prematurely lost if marked Perdido/Desqualificado without objection and before completing 10 days of follow-up
  const isLost = lead.stage === 'Perdido' || lead.result === 'Perdido' || lead.status === 'Desqualificado';
  const isPrematurelyLost = isLost && doneDays < 10 && (!lead.mainObjection || lead.mainObjection === '');

  return {
    doneDays,
    maxDayReached,
    nextPendingDay,
    daysSinceEntry,
    isStaleOver3Days,
    isPrematurelyLost,
  };
}

export function computeAnalytics(leads: Lead[]) {
  const total = leads.length;
  const qualifiedSim = leads.filter((l) => l.qualified === 'Sim').length;
  const qualifiedNao = leads.filter((l) => l.qualified === 'Não').length;
  const qualifiedVerificar = leads.filter((l) => l.qualified === 'A verificar').length;
  const qualifiedRate = total > 0 ? (qualifiedSim / total) * 100 : 0;

  const fastContactSim = leads.filter((l) => l.contactUnder5Min === 'Sim').length;
  const fastContactNao = leads.filter((l) => l.contactUnder5Min === 'Não').length;
  const fastContactRate = total > 0 ? (fastContactSim / total) * 100 : 0;

  const closedLeads = leads.filter((l) => l.result === 'Fechado' || l.stage === 'Fechado');
  const lostLeads = leads.filter((l) => l.result === 'Perdido' || l.stage === 'Perdido');
  const openLeads = leads.filter((l) => l.result !== 'Fechado' && l.stage !== 'Fechado' && l.result !== 'Perdido' && l.stage !== 'Perdido');

  const conversionRate = total > 0 ? (closedLeads.length / total) * 100 : 0;
  const lossRate = total > 0 ? (lostLeads.length / total) * 100 : 0;

  const totalRevenue = closedLeads.reduce((acc, l) => acc + (l.proposalValue || 0), 0);
  const openPipelineValue = openLeads.reduce((acc, l) => acc + (l.proposalValue || 0), 0);

  // Funnel counts
  const stageCounts: Record<string, number> = {
    '1º Contato': 0,
    Diagnóstico: 0,
    'Proposta enviada': 0,
    Negociação: 0,
    Fechado: 0,
    Perdido: 0,
  };
  leads.forEach((l) => {
    stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1;
  });

  // Objections breakdown
  const objectionsMap: Record<string, number> = {};
  leads.forEach((l) => {
    if (l.mainObjection && l.mainObjection.trim() !== '') {
      objectionsMap[l.mainObjection] = (objectionsMap[l.mainObjection] || 0) + 1;
    }
  });

  // Origin breakdown
  const originsStats = ['Tráfego pago', 'Indicação', 'Parceiro', 'Orgânico', 'Outros'].map((origin) => {
    const fromOrigin = leads.filter((l) => l.origin === origin);
    const closedFromOrigin = fromOrigin.filter((l) => l.result === 'Fechado' || l.stage === 'Fechado');
    return {
      origin,
      total: fromOrigin.length,
      closed: closedFromOrigin.length,
      shareOfClosed: closedLeads.length > 0 ? (closedFromOrigin.length / closedLeads.length) * 100 : 0,
      conversionRate: fromOrigin.length > 0 ? (closedFromOrigin.length / fromOrigin.length) * 100 : 0,
    };
  });

  // Cadence & process compliance
  let staleLeadsCount = 0;
  let prematureLostCount = 0;
  let totalContactsMade = 0;

  leads.forEach((l) => {
    const prog = getCadenceProgress(l);
    if (prog.isStaleOver3Days) staleLeadsCount++;
    if (prog.isPrematurelyLost) prematureLostCount++;
    totalContactsMade += prog.doneDays;
  });

  const avgFollowupDays = total > 0 ? totalContactsMade / total : 0;

  // Seller stats
  const sellerNames = Array.from(new Set(['Anne', 'João', 'Tainá', 'Mariah', 'Amanda', 'Sthepani', ...leads.map((l) => l.seller)]));
  const sellerStats = sellerNames.map((seller) => {
    const sLeads = leads.filter((l) => l.seller === seller);
    const sClosed = sLeads.filter((l) => l.result === 'Fechado' || l.stage === 'Fechado');
    const sQual = sLeads.filter((l) => l.qualified === 'Sim');
    const sLost = sLeads.filter((l) => l.result === 'Perdido' || l.stage === 'Perdido');
    const sFast = sLeads.filter((l) => l.contactUnder5Min === 'Sim');
    const sStale = sLeads.filter((l) => getCadenceProgress(l).isStaleOver3Days);
    return {
      seller,
      total: sLeads.length,
      closed: sClosed.length,
      conversionRate: sLeads.length > 0 ? (sClosed.length / sLeads.length) * 100 : 0,
      qualified: sQual.length,
      qualifiedRate: sLeads.length > 0 ? (sQual.length / sLeads.length) * 100 : 0,
      lost: sLost.length,
      fastRate: sLeads.length > 0 ? (sFast.length / sLeads.length) * 100 : 0,
      staleCount: sStale.length,
      revenue: sClosed.reduce((acc, l) => acc + (l.proposalValue || 0), 0),
    };
  });

  // Automated Diagnostic Findings (Pontos de Falha e Pontos Positivos)
  const findings: DiagnosticFinding[] = [];

  if (conversionRate >= 15) {
    findings.push({
      id: 'pos-conv',
      type: 'positivo',
      metric: 'Taxa de Conversão Geral',
      currentValue: `${conversionRate.toFixed(1)}%`,
      targetValue: '≥ 15,0%',
      title: 'Alta Taxa de Fechamento Geral',
      description: `O time converteu ${closedLeads.length} de ${total} leads em associados (${conversionRate.toFixed(1)}%), superando a meta de 15% da Autocar.`,
      actionableAdvice: 'Manter o script de fechamento por ligação e replicar a abordagem de desconto pontual (ex: caso Joseildo) para leads em negociação.',
    });
  } else {
    findings.push({
      id: 'fail-conv',
      type: 'falha',
      metric: 'Taxa de Conversão Geral',
      currentValue: `${conversionRate.toFixed(1)}%`,
      targetValue: '≥ 15,0%',
      title: 'Conversão Abaixo da Meta de 15%',
      description: `Apenas ${closedLeads.length} fechamentos em ${total} leads.`,
      actionableAdvice: 'Auditar leads parados na etapa "Proposta enviada" e intensificar ligações nos dias D+3 e D+5.',
    });
  }

  const paidTraffic = originsStats.find((o) => o.origin === 'Tráfego pago');
  if (paidTraffic && paidTraffic.total >= 5 && paidTraffic.conversionRate < 10) {
    findings.push({
      id: 'fail-paid',
      type: 'falha',
      metric: 'Conversão Tráfego Pago',
      currentValue: `${paidTraffic.conversionRate.toFixed(1)}% (${paidTraffic.closed}/${paidTraffic.total})`,
      targetValue: '≥ 12,0%',
      title: 'Baixa Conversão nos Leads de Tráfego Pago',
      description: `Dos ${paidTraffic.total} leads vindos de Tráfego Pago, houve ${paidTraffic.closed} fechamentos. Muitos ficam em "1º Contato" ou "A verificar" sem responder.`,
      actionableAdvice: 'Trocar mensagem padrão de texto no D+1 e D+2 por Áudio WZ + Ligação rápida nos primeiros 5 minutos após entrada do lead.',
      affectedLeadsCount: paidTraffic.total - paidTraffic.closed,
    });
  }

  if (prematureLostCount > 0) {
    findings.push({
      id: 'fail-d10',
      type: 'falha',
      metric: 'Cadência até D+10',
      currentValue: `${prematureLostCount} leads descartados cedo`,
      targetValue: '10 dias de tentativa',
      title: 'Desqualificação Prematura Antes do 10º Dia (D+10)',
      description: `${prematureLostCount} leads foram marcados como Perdido/Desqualificado com apenas 3 ou 4 tentativas de contato, antes de cumprir a recomendação de ir até o 10º dia.`,
      actionableAdvice: 'Não encerrar leads por "Sem retorno" antes de completar a cadência diária até o D+10 alternando canais (WhatsApp, Áudio WZ e Ligação).',
      affectedLeadsCount: prematureLostCount,
    });
  }

  if (fastContactRate < 70) {
    findings.push({
      id: 'alert-speed',
      type: 'alerta',
      metric: 'Velocidade de Contato (≤ 5 min)',
      currentValue: `${fastContactRate.toFixed(1)}%`,
      targetValue: '≥ 70,0%',
      title: 'Janela de Ouro Perdida em Parte dos Leads',
      description: `${fastContactNao} leads (${(100 - fastContactRate).toFixed(1)}%) não foram atendidos nos primeiros 5 minutos.`,
      actionableAdvice: 'Ativar alerta imediato na chegada de leads (especialmente às 06h–08h e após 17h) para garantir o 1º contato em menos de 5 minutos.',
      affectedLeadsCount: fastContactNao,
    });
  } else {
    findings.push({
      id: 'pos-speed',
      type: 'positivo',
      metric: 'Velocidade de Contato (≤ 5 min)',
      currentValue: `${fastContactRate.toFixed(1)}%`,
      targetValue: '≥ 70,0%',
      title: 'Velocidade de 1º Contato Dentro da Meta',
      description: `${fastContactSim} de ${total} leads atendidos em até 5 minutos.`,
      actionableAdvice: 'Continuar monitorando o tempo de resposta inicial.',
    });
  }

  if (qualifiedRate < 60) {
    findings.push({
      id: 'alert-qual',
      type: 'alerta',
      metric: 'Taxa de Qualificação',
      currentValue: `${qualifiedRate.toFixed(1)}%`,
      targetValue: '> 60,0%',
      title: 'Alto Volume de Leads "A Verificar" ou Não Qualificados',
      description: `Apenas ${qualifiedSim} leads (${qualifiedRate.toFixed(1)}%) estão marcados como Qualificados ("Sim"), enquanto ${qualifiedVerificar} ainda estão "A verificar".`,
      actionableAdvice: 'Fazer perguntas de diagnóstico logo na 2ª mensagem (modelo/ano do veículo e uso) para tirar o lead do status "A verificar".',
      affectedLeadsCount: qualifiedVerificar,
    });
  }

  if (staleLeadsCount > 0) {
    findings.push({
      id: 'fail-stale',
      type: 'falha',
      metric: 'Leads Sem Movimentação (> 3 dias)',
      currentValue: `${staleLeadsCount} leads parados`,
      targetValue: '0 leads > 3 dias',
      title: 'Regra de Ouro Violada: Leads Sem Contato Há Mais de 3 Dias',
      description: `Existem ${staleLeadsCount} leads em aberto sem registro de novo follow-up há mais de 3 dias.`,
      actionableAdvice: 'Acessar a aba "Follow-up Diário (D+1 a D+10)" e priorizar a fila de atrasados hoje.',
      affectedLeadsCount: staleLeadsCount,
    });
  }

  return {
    total,
    qualifiedSim,
    qualifiedNao,
    qualifiedVerificar,
    qualifiedRate,
    fastContactSim,
    fastContactNao,
    fastContactRate,
    closedCount: closedLeads.length,
    lostCount: lostLeads.length,
    openCount: openLeads.length,
    conversionRate,
    lossRate,
    totalRevenue,
    openPipelineValue,
    stageCounts,
    objectionsMap,
    originsStats,
    staleLeadsCount,
    prematureLostCount,
    avgFollowupDays,
    sellerStats,
    findings,
  };
}
