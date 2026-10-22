#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:3000/api/mcp';

async function callCrmMcpApi(tool, args = {}) {
  const res = await fetch(CRM_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, arguments: args }),
  });
  if (!res.ok) {
    throw new Error(`Erro na API do CRM (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

const server = new McpServer({
  name: 'autocar-crm-mcp',
  version: '1.0.0',
});

// 1. Resumo completo do Dashboard e Metas da Autocar
server.tool(
  'get_crm_dashboard_summary',
  'Retorna todas as métricas comerciais da Autocar Proteção Veicular (conversão, velocidade <=5min, qualificação, funil, receita e ranking por vendedora)',
  {
    seller: z.string().optional().describe('Nome da vendedora para filtrar (ex: Anne, João, Tainá) ou vazio para visão geral'),
  },
  async ({ seller }) => {
    const data = await callCrmMcpApi('get_crm_dashboard_summary', { seller });
    return {
      content: [{ type: 'text', text: JSON.stringify(data.result, null, 2) }],
    };
  }
);

// 2. Diagnóstico de Pontos de Falha e Pontos Positivos
server.tool(
  'get_diagnostic_failures_and_positives',
  'Analisa automaticamente os gargalos do processo comercial (ex: descarte antes do D+10, baixa conversão em tráfego pago, leads sem contato >3 dias) e pontos positivos',
  {},
  async () => {
    const data = await callCrmMcpApi('get_diagnostic_failures_and_positives', {});
    return {
      content: [{ type: 'text', text: JSON.stringify(data.result, null, 2) }],
    };
  }
);

// 3. Listar leads que precisam de Follow-up Diário (D+1 a D+10)
server.tool(
  'list_leads_needing_followup_d1_to_d10',
  'Lista leads ativos na cadência de 10 dias (D+1 a D+10), destacando quantos dias já foram feitos, próximo dia pendente e se foram descartados antes do D+10',
  {
    seller: z.string().optional().describe('Filtrar por vendedora (ex: Anne)'),
  },
  async ({ seller }) => {
    const data = await callCrmMcpApi('list_leads_needing_followup_d1_to_d10', { seller });
    return {
      content: [{ type: 'text', text: JSON.stringify(data.result, null, 2) }],
    };
  }
);

// 4. Enviar Feedback Automatizado do Claude para o painel do vendedor
server.tool(
  'send_automated_feedback_to_seller',
  'Envia um card de feedback/orientação comercial diretamente para a tela do vendedor no CRM Autocar',
  {
    targetSeller: z.string().describe('Nome da vendedora (ex: Anne, João, Tainá, Mariah, Amanda, Sthepani ou Todos)'),
    severity: z.enum(['positivo', 'atencao', 'critico']).describe('Nível de prioridade do feedback'),
    title: z.string().describe('Título curto e direto do feedback'),
    message: z.string().describe('Mensagem detalhada com recomendações práticas e nomes dos leads'),
  },
  async (args) => {
    const data = await callCrmMcpApi('send_automated_feedback_to_seller', args);
    return {
      content: [
        {
          type: 'text',
          text: `Feedback enviado com sucesso para ${args.targetSeller}: ${JSON.stringify(data.result.feedback)}`,
        },
      ],
    };
  }
);

// 5. Atualizar dia da cadência (D+1..D+10) ou etapa do lead
server.tool(
  'update_lead_followup_or_stage',
  'Registra um follow-up diário (D+1 até D+10) ou atualiza etapa/observação de um lead no CRM',
  {
    leadId: z.string().describe('ID do lead (ex: lead-6)'),
    day: z.number().min(1).max(10).optional().describe('Dia da cadência de follow-up (1 a 10)'),
    status: z.enum(['Feito', 'Pendente', 'Pulado']).optional().describe('Status do dia de follow-up'),
    stage: z
      .enum(['1º Contato', 'Diagnóstico', 'Proposta enviada', 'Negociação', 'Fechado', 'Perdido'])
      .optional()
      .describe('Nova etapa do funil'),
    note: z.string().optional().describe('Observação para adicionar ao histórico do lead'),
  },
  async (args) => {
    const data = await callCrmMcpApi('update_lead_followup_or_stage', args);
    return {
      content: [{ type: 'text', text: JSON.stringify(data.result, null, 2) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Erro ao iniciar servidor MCP Autocar CRM:', err);
  process.exit(1);
});
