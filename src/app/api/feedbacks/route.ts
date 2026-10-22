import { NextRequest, NextResponse } from 'next/server';
import { getStoredFeedbacks, saveStoredFeedbacks } from '@/lib/store';
import { SellerFeedback } from '@/types/crm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seller = searchParams.get('seller');
  let feedbacks = getStoredFeedbacks();

  if (seller && seller !== 'Todos' && seller !== 'admin') {
    feedbacks = feedbacks.filter(
      (f) => f.targetSeller.toLowerCase() === seller.toLowerCase() || f.targetSeller === 'Todos'
    );
  }

  return NextResponse.json({ feedbacks });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const feedbacks = getStoredFeedbacks();

    const newFb: SellerFeedback = {
      id: `fb-${Date.now()}`,
      createdAt: new Date().toISOString(),
      targetSeller: body.targetSeller || 'Anne',
      author: body.author || 'Gestor',
      severity: body.severity || 'atencao',
      title: body.title || 'Feedback de Acompanhamento',
      message: body.message || '',
      read: false,
    };

    const updated = [newFb, ...feedbacks];
    saveStoredFeedbacks(updated);
    return NextResponse.json({ feedback: newFb, feedbacks: updated, ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, read } = body;
    const feedbacks = getStoredFeedbacks();
    const idx = feedbacks.findIndex((f) => f.id === id);
    if (idx !== -1) {
      feedbacks[idx].read = read ?? true;
      saveStoredFeedbacks(feedbacks);
    }
    return NextResponse.json({ feedbacks, ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
