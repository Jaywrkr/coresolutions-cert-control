"use client";

import { Award, Bell, Building2, ChevronRight, FileCheck2, Search, ShieldCheck, Users } from "lucide-react";

const brands = [
  { name: "IBM", compliance: 88, status: "En riesgo", requirements: "7 de 8", detail: "Falta 1 certificación técnica" },
  { name: "Lenovo", compliance: 100, status: "Cumplido", requirements: "6 de 6", detail: "Sin acciones pendientes" },
  { name: "VMware", compliance: 75, status: "En riesgo", requirements: "3 de 4", detail: "1 requisito vence pronto" },
  { name: "Veeam", compliance: 60, status: "Pendiente", requirements: "3 de 5", detail: "Faltan 2 certificaciones" },
  { name: "Check Point", compliance: 100, status: "Cumplido", requirements: "4 de 4", detail: "Sin acciones pendientes" },
];

const alerts = [
  { title: "IBM FlashSystem Technical", meta: "Falta 1 técnico certificado", tone: "critical" },
  { title: "VMware VCP-VCF", meta: "Vence en 42 días · Christian F.", tone: "warning" },
  { title: "Veeam VMCE", meta: "Examen pendiente · Patricio G.", tone: "neutral" },
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">CORE</div>
          <span>CoreCert</span>
        </div>
        <nav>
          <a className="active"><ShieldCheck size={19}/>Resumen</a>
          <a><Building2 size={19}/>Marcas</a>
          <a><Users size={19}/>Técnicos</a>
          <a><Award size={19}/>Certificaciones</a>
          <a><FileCheck2 size={19}/>Requisitos</a>
        </nav>
        <div className="sidebar-footer">Coresolutions · Uso interno</div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">CONTROL DE CANAL</p>
            <h1>Certificaciones</h1>
          </div>
          <div className="top-actions">
            <div className="search"><Search size={18}/><span>Buscar</span></div>
            <button className="icon-button"><Bell size={19}/><i /></button>
            <div className="avatar">JJ</div>
          </div>
        </header>

        <section className="hero-card">
          <div>
            <span className="hero-label">CUMPLIMIENTO GENERAL</span>
            <strong>84%</strong>
            <p>23 de 27 requisitos vigentes están cubiertos.</p>
          </div>
          <div className="hero-progress"><span style={{ width: "84%" }} /></div>
          <button>Ver brechas <ChevronRight size={17}/></button>
        </section>

        <section className="stats-grid">
          <article><span>Marcas activas</span><strong>9</strong><small>5 con requisitos cargados</small></article>
          <article><span>Técnicos</span><strong>7</strong><small>6 con certificados vigentes</small></article>
          <article><span>Por vencer</span><strong>4</strong><small>En los próximos 90 días</small></article>
          <article><span>Brechas abiertas</span><strong>4</strong><small>Requieren acción</small></article>
        </section>

        <section className="main-grid">
          <div className="panel brands-panel">
            <div className="panel-heading"><div><span className="kicker">ESTADO ACTUAL</span><h2>Cumplimiento por marca</h2></div><button className="text-button">Ver todas</button></div>
            <div className="brand-list">
              {brands.map((brand) => (
                <article className="brand-row" key={brand.name}>
                  <div className="brand-logo">{brand.name.slice(0, 2)}</div>
                  <div className="brand-info"><strong>{brand.name}</strong><span>{brand.detail}</span></div>
                  <div className="requirement-count"><span>Requisitos</span><strong>{brand.requirements}</strong></div>
                  <div className="progress-wrap"><div><span style={{ width: `${brand.compliance}%` }}/></div><b>{brand.compliance}%</b></div>
                  <span className={`status ${brand.status.toLowerCase().replace(" ", "-")}`}>{brand.status}</span>
                  <ChevronRight size={18} className="chevron"/>
                </article>
              ))}
            </div>
          </div>

          <aside className="panel alert-panel">
            <div className="panel-heading"><div><span className="kicker">PRIORIDAD</span><h2>Alertas</h2></div><span className="badge">3</span></div>
            <div className="alert-list">
              {alerts.map((alert) => (
                <article key={alert.title} className={`alert ${alert.tone}`}>
                  <span className="alert-dot" />
                  <div><strong>{alert.title}</strong><p>{alert.meta}</p></div>
                  <ChevronRight size={17}/>
                </article>
              ))}
            </div>
            <button className="full-button">Revisar todas las alertas</button>
          </aside>
        </section>
      </section>
    </main>
  );
}
