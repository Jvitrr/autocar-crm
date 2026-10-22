import { NextRequest, NextResponse } from 'next/server';
import { getStoredLeads, saveStoredLeads, getStoredFeedbacks, saveStoredFeedbacks } from '@/lib/store';
import { computeAnalytics, getCadenceProgress } from '@/lib/analytics';

/**
 * Endpoint REST + JSON-RPC para o Servidor MCP (Model Context Protocol) do Autocar CRM.
 * Permite que o Claude consulte diagnósticos, leads parados, cadência D+1..D+10 e envie feedbacks automáticos.
 */
export async function GET() {
  const leads = getStoredLeads();
  const analytics = computeAnalytics(leads);
  const feedbacks = getStoredFeedbacks();

  return NextResponse.json({
    server: 'autocar-crm-mcp',
    version: '1.0.0',
    tools: [
      'get_crm_dashboard_summary',
      'get_diagnostic_failures_and_positives',
      'list_leads_needing_followup_d1_to_d10',
      'send_Automated_feedback_to_seller',
      'update_lead_followup_or_stage',
    ],
    snapshot: {
      totalLeads: analytics.total,
      conversionRate: `${analytics.conversionRate.toFixed(1)}%`,
      fastContactRate: `${analytics.fastContactRate.toFixed(1)}%`,
      qualifiedRate: `${analytics.qualifiedRate.toFixed(1)}%`,
      staleLeadsCount: analytics.staleLeadsCount,
      prematureLostCount: analytics.prematureLostCount,
      findings: analytics.findings,
      recentFeedbacksCount: feedbacks.length,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tool, arguments: args = {} } = body;

    const leads = getStoredLeads();
    const analytics = computeAnalytics(leads);

    if (tool === 'get_crm_dashboard_summary') {
      const sellerFilter = args.seller;
      const filtered = sellerFilter ? leads.filter((l) => l.seller.toLowerCase() === sellerFilter.toLowerCase()) : leads;
      const stats = computeAnalytics(filtered);
      return NextResponse.json({ result: stats });
    }

    if (tool === 'get_diagnostic_failures_and_positives') {
      return NextResponse.json({
        result: {
          findings: analytics.findings,
          sellerStats: analytics.sellerStats,
          originsStats: analytics.originsStats,
          objectionsMap: analytics.objectionsMap,
        },
      });
    }

    if (tool === 'list_leads_needing_followup_d1_to_d10') {
      const sellerFilter = args.seller;
      const list = leads
        .filter((l) => !sellerFilter || l.seller.toLowerCase() === sellerFilter.toLowerCase())
        .map((l) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          seller: l.seller,
          stage: l.stage,
          status: l.status,
          origin: l.origin,
          vehicle: l.vehicle,
          notes: l.notes,
          progress: getCadenceProgress(l),
        }))
        .filter((item) => item.stage !== 'Fechado' && (item.stage !== 'Perdido' || item.progress.isPrematurelyLost));

      return NextResponse.json({ result: list });
    }

    if (tool === 'send_automated_feedback_to_seller') {
      const feedbacks = getStoredFeedbacks();
      const newFb = {
        id: `fb-${Date.now()}`,
        createdAt: new Date().toISOString(),
        targetSeller: args.targetSeller || 'Anne',
        author: 'Claude MCP',
        severity: args.severity || 'atencao',
        title: args.title || 'Feedback Automatizado via Claude MCP',
        message: args.message || '',
        read: false,
      };
      const updated = [newFb, ...feedbacks];
      saveStoredFeedbacks(updated);
      return NextResponse.json({ result: { ok: true, feedback: newFb } });
    }

    if (tool === 'update_lead_followup_or_stage') {
      const { leadId, day, status, stage, note } = args;
      const idx = leads.findIndex((l) => l.id === leadId);
      if (idx === -1) {
        return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
      }
      const lead = { ...leads[idx] };
      if (stage) lead.stage = stage;
      if (note) lead.notes = `${lead.notes ? lead.notes + ' // ' : ''}[MCP]: ${note}`;
      if (day && day >= 1 && day <= 10) {
        lead.cadence = {
          ...lead.cadence,
          [`d${day}`]: {
            day,
            status: status || 'Feito',
            date: new Date().toISOString().split('T')[0],
            channel: args.channel || lead.channel || 'WhatsApp',
            responded: Boolean(args.responded),
          },
        };
      }
      leads[idx] = lead;
      saveStoredLeads(leads);
      return NextResponse.json({ result: { ok: true, lead } });
    }

    return NextResponse.json({ error: `Ferramenta MCP desconhecida: ${tool}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
