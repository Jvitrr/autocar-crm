import { NextRequest, NextResponse } from 'next/server';
import { getStoredLeads, saveStoredLeads } from '@/lib/store';
import { Lead } from '@/types/crm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seller = searchParams.get('seller');
  let leads = getStoredLeads();

  if (seller && seller !== 'Todos' && seller !== 'admin') {
    leads = leads.filter((l) => l.seller.toLowerCase() === seller.toLowerCase());
  }

  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const leads = getStoredLeads();

    // Support bulk replace/import or single lead creation
    if (Array.isArray(body.leads)) {
      saveStoredLeads(body.leads);
      return NextResponse.json({ leads: body.leads, ok: true });
    }

    const newLead: Lead = body.lead;
    const updated = [newLead, ...leads];
    saveStoredLeads(updated);
    return NextResponse.json({ lead: newLead, leads: updated, ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, updates } = body;
    const leads = getStoredLeads();
    const idx = leads.findIndex((l) => l.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    leads[idx] = { ...leads[idx], ...updates };
    saveStoredLeads(leads);
    return NextResponse.json({ lead: leads[idx], ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
