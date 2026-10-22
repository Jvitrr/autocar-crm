import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Autocar CRM — Controle Comercial & Follow-up D+1 a D+10',
  description:
    'Sistema de CRM Comercial da Autocar Proteção Veicular com cadência diária até o 10º dia, painel de diagnóstico de gestão e servidor MCP integrado ao Claude.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
