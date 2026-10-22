export type LeadOrigin = 'Tráfego pago' | 'Indicação' | 'Parceiro' | 'Orgânico' | 'Outros';

export type QualifiedStatus = 'Sim' | 'Não' | 'A verificar';

export type FunnelStage =
  | '1º Contato'
  | 'Diagnóstico'
  | 'Proposta enviada'
  | 'Negociação'
  | 'Fechado'
  | 'Perdido';

export type LeadStatus =
  | 'Em andamento'
  | 'Aguardando'
  | 'Não atendeu'
  | 'Associado'
  | 'Desqualificado'
  | 'Reaquecimento';

export type LeadObjection =
  | ''
  | 'Tá caro'
  | 'Vou pensar'
  | 'Já tenho seguro'
  | 'Precisa do cônjuge'
  | 'Não conheço a Autocar'
  | 'Não tem interesse'
  | 'Pesquisando mais'
  | 'Outro';

export type LeadResult = 'Fechado' | 'Perdido' | 'Em aberto';

export type ContactChannel = 'WhatsApp' | 'Ligação' | 'Áudio WZ' | 'E-mail' | 'Outro';

export type FollowupFinalStatus =
  | 'Em andamento'
  | 'Aguardando cônjuge'
  | 'Aguardando resposta'
  | 'Desqualificar'
  | 'Retentar'
  | 'Fechado';

export type CadenceDayStatus = 'Pendente' | 'Feito' | 'Pulado' | 'Encerrado';

export interface CadenceItem {
  day: number; // 1 to 10
  status: CadenceDayStatus;
  date: string | null;
  channel: string | null;
  responded: boolean;
  note?: string;
}

export interface Lead {
  id: string;
  number: number;
  entryDate: string; // YYYY-MM-DD
  name: string;
  phone: string;
  origin: string;
  vehicle: string;
  qualified: string;
  stage: string;
  status: string;
  contactUnder5Min: string; // 'Sim' | 'Não'
  firstContactDate: string | null;
  contactsCount: number;
  mainObjection: string;
  proposalValue: number | null;
  closingDate: string | null;
  result: string;
  notes: string;
  seller: string;
  channel: string;
  responded: string; // 'Sim' | 'Não' | 'Pendente'
  noResponseReason: string;
  followupStatus: string;
  nextContactDate: string | null;
  cadence: Record<string, CadenceItem>; // d1..d10
}

export interface SellerFeedback {
  id: string;
  createdAt: string;
  targetSeller: string; // 'Todos' | seller name
  author: string; // 'Gestor' | 'Claude MCP'
  severity: 'positivo' | 'atencao' | 'critico';
  title: string;
  message: string;
  relatedLeadIds?: string[];
  read: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  role: 'admin' | 'seller';
  email: string;
  avatar: string;
  monthlyGoal: number;
}

export const SELLERS_LIST: UserProfile[] = [
  { id: 'admin-1', name: 'Gestor Comercial (Admin)', role: 'admin', email: 'gestao@autocar.com.br', avatar: 'GC', monthlyGoal: 60 },
  { id: 'seller-anne', name: 'Anne', role: 'seller', email: 'anne@autocar.com.br', avatar: 'AN', monthlyGoal: 15 },
  { id: 'seller-joao', name: 'João', role: 'seller', email: 'joao@autocar.com.br', avatar: 'JO', monthlyGoal: 15 },
  { id: 'seller-taina', name: 'Tainá', role: 'seller', email: 'taina@autocar.com.br', avatar: 'TA', monthlyGoal: 15 },
  { id: 'seller-mariah', name: 'Mariah', role: 'seller', email: 'mariah@autocar.com.br', avatar: 'MA', monthlyGoal: 15 },
  { id: 'seller-amanda', name: 'Amanda', role: 'seller', email: 'amanda@autocar.com.br', avatar: 'AM', monthlyGoal: 15 },
  { id: 'seller-sthepani', name: 'Sthepani', role: 'seller', email: 'sthepani@autocar.com.br', avatar: 'ST', monthlyGoal: 15 },
];

export const ORIGINS_LIST: LeadOrigin[] = [
  'Tráfego pago',
  'Indicação',
  'Parceiro',
  'Orgânico',
  'Outros',
];

export const STAGES_LIST: FunnelStage[] = [
  '1º Contato',
  'Diagnóstico',
  'Proposta enviada',
  'Negociação',
  'Fechado',
  'Perdido',
];

export const STATUS_LIST: LeadStatus[] = [
  'Em andamento',
  'Aguardando',
  'Não atendeu',
  'Associado',
  'Desqualificado',
  'Reaquecimento',
];

export const OBJECTIONS_LIST: LeadObjection[] = [
  '',
  'Tá caro',
  'Vou pensar',
  'Já tenho seguro',
  'Precisa do cônjuge',
  'Não conheço a Autocar',
  'Não tem interesse',
  'Pesquisando mais',
  'Outro',
];

export const CHANNELS_LIST: ContactChannel[] = [
  'WhatsApp',
  'Ligação',
  'Áudio WZ',
  'E-mail',
  'Outro',
];
