import fs from 'fs';
import path from 'path';
import { Lead, SellerFeedback } from '@/types/crm';
import initialLeads from '@/data/initial-leads.json';
import initialFeedbacks from '@/data/initial-feedbacks.json';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'runtime-leads.json');
const FEEDBACKS_FILE = path.join(DATA_DIR, 'runtime-feedbacks.json');

export function getStoredLeads(): Lead[] {
  try {
    if (fs.existsSync(LEADS_FILE)) {
      const raw = fs.readFileSync(LEADS_FILE, 'utf-8');
      return JSON.parse(raw) as Lead[];
    }
  } catch {
    // fallback to initialLeads
  }
  return initialLeads as unknown as Lead[];
}

export function saveStoredLeads(leads: Lead[]): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export function getStoredFeedbacks(): SellerFeedback[] {
  try {
    if (fs.existsSync(FEEDBACKS_FILE)) {
      const raw = fs.readFileSync(FEEDBACKS_FILE, 'utf-8');
      return JSON.parse(raw) as SellerFeedback[];
    }
  } catch {
    // fallback
  }
  return initialFeedbacks as unknown as SellerFeedback[];
}

export function saveStoredFeedbacks(feedbacks: SellerFeedback[]): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(FEEDBACKS_FILE, JSON.stringify(feedbacks, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}
