import { Lead } from '@/types/crm';
import { getCadenceProgress } from './analytics';

export interface ActiveContactSuggestion {
  leadId: string;
  priorityScore: number; // 0 to 100
  priorityLabel: 'URGENTE HOJE' | 'ALTA PRIORIDADE' | 'NUTRIÇÃO ATIVA';
  recommendedChannel: 'Ligação + WhatsApp' | 'Áudio WZ' | 'WhatsApp Direto' | 'Ligação de Fechamento';
  currentDayLabel: string;
  attentionPoints: string[];
  strategyTitle: string;
  strategyExplanation: string;
  suggestedScript: string;
  detectedContext: {
    vehicleType: 'Moto' | 'Carro' | 'Indefinido';
    quotedPlans: string[];
    competitorMentioned: boolean;
    waitingThirdParty: boolean;
    coverageConcern: boolean;
  };
}

export function generateLeadSuggestion(lead: Lead): ActiveContactSuggestion {
  const prog = getCadenceProgress(lead);
  const notesLower = (lead.notes || '').toLowerCase();
  const reasonLower = (lead.noResponseReason || '').toLowerCase();
  const combinedText = `${notesLower} ${reasonLower}`;
  const vehicle = lead.vehicle?.trim() || '';
  const vehicleLower = vehicle.toLowerCase();

  // Detect vehicle category
  const isMoto =
    vehicleLower.includes('fan') ||
    vehicleLower.includes('start') ||
    vehicleLower.includes('factor') ||
    vehicleLower.includes('pop') ||
    vehicleLower.includes('crypton') ||
    vehicleLower.includes('moto') ||
    vehicleLower.includes('sbm') ||
    vehicleLower.includes('biz') ||
    vehicleLower.includes('cg') ||
    vehicleLower.includes('titan') ||
    vehicleLower.includes('xre') ||
    vehicleLower.includes('bros') ||
    combinedText.includes('moto');

  const vehicleType: 'Moto' | 'Carro' | 'Indefinido' = isMoto
    ? 'Moto'
    : vehicle
    ? 'Carro'
    : 'Indefinido';

  // Extract quoted plans from notes if present
  const quotedPlans: string[] = [];
  if (combinedText.includes('basico') || combinedText.includes('básico')) quotedPlans.push('Básico');
  if (combinedText.includes('master')) quotedPlans.push('Master');
  if (combinedText.includes('exclusivo')) quotedPlans.push('Exclusivo');

  const competitorMentioned =
    combinedText.includes('seguradora') ||
    combinedText.includes('agilly') ||
    combinedText.includes('amigo paga') ||
    combinedText.includes('outra proteção') ||
    lead.mainObjection === 'Já tenho seguro';

  const waitingThirdParty =
    combinedText.includes('marido') ||
    combinedText.includes('esposo') ||
    combinedText.includes('esposa') ||
    combinedText.includes('cônjuge') ||
    lead.mainObjection === 'Precisa do cônjuge';

  const coverageConcern =
    combinedText.includes('incendio') ||
    combinedText.includes('incêndio') ||
    combinedText.includes('rastreador') ||
    combinedText.includes('cobertura');

  const attentionPoints: string[] = [];
  let priorityScore = 50;
  let recommendedChannel: ActiveContactSuggestion['recommendedChannel'] = 'WhatsApp Direto';
  let strategyTitle = '';
  let strategyExplanation = '';
  let suggestedScript = '';

  const nextDay = prog.nextPendingDay || Math.min(10, prog.doneDays + 1);
  const currentDayLabel = `D+${nextDay} (${prog.doneDays}/10 feitos)`;
  const vName = vehicle ? `seu ${vehicle}` : 'seu veículo';

  // 1. Check Attention Points based on lead data
  if (lead.contactUnder5Min === 'Não') {
    attentionPoints.push(
      'Janela de Ouro perdida (>5 min no 1º contato): Lead esfriou na chegada; evite mensagens genéricas de texto, use Áudio WZ chamando pelo nome.'
    );
    priorityScore += 10;
  }

  if (prog.isPrematurelyLost) {
    attentionPoints.push(
      `Descarte prematuro detectado: Lead foi marcado como Perdido com apenas ${prog.doneDays}/10 dias de follow-up sem objeção definitiva. Retomar cadência até o D+10!`
    );
    priorityScore += 25;
  }

  if (prog.isStaleOver3Days) {
    attentionPoints.push(
      'Regra de Ouro violada: Lead está há mais de 3 dias sem nenhuma movimentação registrada.'
    );
    priorityScore += 20;
  }

  if (!vehicle) {
    attentionPoints.push(
      'Veículo ainda não identificado: Sem saber o modelo/ano não há ancoragem de valor. Prioridade #1 é descobrir qual é o carro ou moto.'
    );
  }

  if (lead.qualified === 'A verificar') {
    attentionPoints.push(
      'Qualificação pendente ("A verificar"): Fazer pergunta rápida de filtro (modelo/ano e se já possui proteção ativa).'
    );
  }

  if (waitingThirdParty) {
    attentionPoints.push(
      'Decisão compartilhada (Cônjuge/Família): O lead não decide sozinho. Envie um resumo executivo de 3 linhas comparando o custo-benefício para facilitar a conversa em casa.'
    );
    priorityScore += 15;
  }

  if (competitorMentioned) {
    attentionPoints.push(
      'Comparação com Concorrência / Seguradora Anterior: Destaque assistência 24h, agilidade na ativação e possibilidade de condição especial na adesão.'
    );
    priorityScore += 15;
  }

  if (coverageConcern) {
    attentionPoints.push(
      'Dúvida técnica de Cobertura / Rastreador: Explicar com clareza os detalhes dos planos Master/Exclusivo por ligação ou áudio.'
    );
    priorityScore += 15;
  }

  // 2. Build Tailored Strategy & Script based on Stage + Objection + Notes
  if (lead.stage === 'Proposta enviada' || lead.stage === 'Negociação') {
    priorityScore += 25;
    recommendedChannel = 'Ligação + WhatsApp';

    if (waitingThirdParty) {
      strategyTitle = 'Destravar Decisão com Cônjuge (Resumo Comparativo + Benefício)';
      strategyExplanation =
        'Como o lead informou que precisa alinhar com o marido/esposa, não pergunte apenas "E aí, conversou?". Envie um quadro curto pronto para ela encaminhar no WhatsApp do cônjuge.';
      suggestedScript = `Oi ${lead.name}, tudo bem? Aqui é a ${lead.seller} da Autocar! Sei que você ia conversar com seu esposo sobre a proteção do ${
        vehicle || 'veículo'
      }. Para facilitar para vocês dois, montei um resumo direto dos benefícios que já ficam ativos imediatamente (roubo, furto, colisão e assistência 24h). Vocês chegaram a ver juntos ou ficou alguma dúvida sobre a mensalidade?`;
    } else if (lead.mainObjection === 'Tá caro' || combinedText.includes('caro') || combinedText.includes('valor')) {
      recommendedChannel = 'Ligação de Fechamento';
      strategyTitle = 'Contorno de Preço ("Tá Caro") com Ancoragem de Risco ou Flexibilização';
      strategyExplanation =
        'Na base da Autocar, leads que acharam caro fecharam quando a vendedora ligou, entendeu o orçamento e ajustou entre os planos Básico/Master/Exclusivo ou aplicou condição na adesão.';
      suggestedScript = `Oi ${lead.name}, tudo bem? Aqui é a ${lead.seller} da Autocar! Vi que você avaliou a proposta para ${vName}${
        lead.proposalValue ? ` de R$ ${lead.proposalValue.toFixed(2)}` : ''
      }. Prefiro te falar rapidinho porque consigo verificar com a gerência uma condição diferenciada ou ajustar o plano para caber certinho no seu bolso sem deixar ${vName} desprotegido hoje. Posso te ligar 1 minutinho?`;
    } else if (combinedText.includes('seguradora') || combinedText.includes('baixa')) {
      strategyTitle = 'Acompanhamento de Transição de Seguradora (Timing de Fechamento)';
      strategyExplanation =
        'O lead já tem intenção real de compra e aguarda apenas trâmite da proteção antiga. Garanta que o veículo não fique nenhum dia descoberto.';
      suggestedScript = `Oi ${lead.name}, tudo bem? Aqui é a ${lead.seller} da Autocar! Passando para saber se já deu tudo certo com a baixa na sua proteção anterior para a gente já deixar a proteção da sua ${
        vehicle || 'moto/carro'
      } pronta e você não rodar nenhum dia desprotegido. Conseguimos agilizar a vistoria hoje?`;
    } else if (coverageConcern) {
      strategyTitle = 'Esclarecimento Técnico de Cobertura (Plano Master / Exclusivo)';
      strategyExplanation =
        'O lead travou por dúvida específica de cobertura (ex: incêndio / rastreador). Contate por áudio explicando como funciona a cobertura completa da Autocar.';
      suggestedScript = `Oi ${lead.name}, aqui é a ${lead.seller} da Autocar! Fiquei pensando no ponto que você levantou sobre a cobertura para ${vName}. Consultei nosso setor técnico para ver a melhor configuração no plano Exclusivo que atenda exatamente a segurança que você busca. Posso te explicar em um áudio de 30 segundos?`;
    } else {
      recommendedChannel = 'Áudio WZ';
      strategyTitle = `Reativação de Proposta Enviada (${
        quotedPlans.length > 0 ? `Planos ${quotedPlans.join('/')}` : 'Cotação em Aberto'
      })`;
      strategyExplanation =
        'O lead já recebeu os valores mas silenciou após a cotação. Faça uma pergunta fechada sobre qual dos planos (Básico, Master ou Exclusivo) fez mais sentido.';
      suggestedScript = `Oi ${lead.name}, tudo bem? Aqui é a ${lead.seller} da Autocar! Estou passando no nosso ${nextDay}º dia de acompanhamento da cotação para ${vName}. Dos planos que te enviei (Básico, Master e Exclusivo), qual deles ficou mais próximo do que você planejava investir por mês?`;
    }
  } else if (lead.stage === 'Diagnóstico') {
    priorityScore += 15;
    recommendedChannel = 'Áudio WZ';
    strategyTitle = 'Avançar do Diagnóstico para Envio da Proposta';
    strategyExplanation =
      'Lead já iniciou conversa e está na fase de levantamento de perfil. Apresente os 3 níveis (Básico, Master e Exclusivo) destacando o intermediário/completo.';
    suggestedScript = `Oi ${lead.name}, tudo bem? Aqui é a ${lead.seller} da Autocar! Já finalizei o levantamento para ${vName} e separei as 3 opções de proteção (Básico, Master e Exclusivo). Posso te mandar os valores aqui agora para analisarmos juntos?`;
  } else {
    // 1º Contato ou Perdido Prematuro (Tráfego Pago / Sem Retorno)
    if (nextDay <= 2) {
      recommendedChannel = 'WhatsApp Direto';
      strategyTitle = `Abordagem Rápida de Diagnóstico (D+${nextDay}) — Descobrir Veículo`;
      strategyExplanation =
        'Lead recém-chegado (especialmente de Tráfego Pago). Evite textos longos; faça uma única pergunta direta sobre o modelo e ano do veículo.';
      suggestedScript = `Olá ${lead.name}, tudo bem? Aqui é a ${lead.seller} da Autocar Proteção Veicular! Vi que você solicitou nossa tabela de proteção. Para eu calcular o valor certinho para você agora, qual é o modelo e o ano do seu carro ou moto?`;
    } else if (nextDay >= 3 && nextDay <= 6) {
      recommendedChannel = 'Áudio WZ';
      strategyTitle = `Quebra de Silêncio no Meio da Cadência (D+${nextDay}) via Áudio Curto`;
      strategyExplanation =
        'Leads de Tráfego Pago que não responderam no D+1 e D+2 costumam ignorar texto copiado. Um áudio de 20 segundos no WhatsApp mais uma tentativa de ligação aumenta a taxa de resposta em até 3x.';
      suggestedScript = `[Enviar em Áudio WZ de 20s]: "Oi ${lead.name}, tudo bem? Aqui é a ${lead.seller} da Autocar! Tentei falar com você nos últimos dias porque estamos com uma condição muito bacana na adesão essa semana. Me manda só o modelo e ano do seu veículo aqui que te passo a simulação sem compromisso!"`;
    } else {
      recommendedChannel = 'Ligação + WhatsApp';
      strategyTitle = `Mensagem de Reta Final da Cadência (D+${nextDay} de 10) — Gatilho de Encerramento`;
      strategyExplanation =
        'Nos últimos dias da meta de D+10 (D+7 a D+10), use a técnica de "encerramento de pasta", que gera resposta imediata de quem ainda tem interesse.';
      suggestedScript = `Oi ${lead.name}, tudo bem? Aqui é a ${lead.seller} da Autocar. Como não conseguimos falar nos últimos dias, estou passando no nosso ${nextDay}º dia de acompanhamento antes de encerrar seu atendimento por aqui. Você ainda está buscando proteção para seu veículo ou já resolveu?`;
    }
  }

  if (attentionPoints.length === 0) {
    attentionPoints.push(
      'Cadência em dia: Mantenha a variação de canal (alterne entre mensagem, áudio e ligação até o D+10).'
    );
  }

  const clampedScore = Math.min(100, Math.max(20, priorityScore));
  const priorityLabel: ActiveContactSuggestion['priorityLabel'] =
    clampedScore >= 75 ? 'URGENTE HOJE' : clampedScore >= 55 ? 'ALTA PRIORIDADE' : 'NUTRIÇÃO ATIVA';

  return {
    leadId: lead.id,
    priorityScore: clampedScore,
    priorityLabel,
    recommendedChannel,
    currentDayLabel,
    attentionPoints,
    strategyTitle,
    strategyExplanation,
    suggestedScript,
    detectedContext: {
      vehicleType,
      quotedPlans,
      competitorMentioned,
      waitingThirdParty,
      coverageConcern,
    },
  };
}
