"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Award, Bell, Building2, ChevronRight, FileCheck2, LogOut, Search, ShieldCheck, Users } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";

type Brand = { id: string; name: string; status: string };
type Technician = { id: string; full_name: string; status: string };
type Requirement = { id: string; brand_id: string; certification_id: string; required_count: number };
type CertificationRecord = { id: string; certification_id: string; technician_id: string; status: string; expires_at: string | null };

type BrandSummary = {
  id: string;
  name: string;
  required: number;
  covered: number;
  compliance: number;
  status: "Cumplido" | "En riesgo" | "Pendiente";
};

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [records, setRecords] = useState<CertificationRecord[]>([]);

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to configure Supabase.");
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    async function loadDashboard() {
      let supabase;
      try {
        supabase = getSupabaseClient();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to configure Supabase.");
        setLoading(false);
        return;
      }

      setLoading(true);
      const [brandsResult, techniciansResult, requirementsResult, recordsResult] = await Promise.all([
        supabase.from("brands").select("id,name,status").order("name"),
        supabase.from("technicians").select("id,full_name,status").order("full_name"),
        supabase.from("brand_requirements").select("id,brand_id,certification_id,required_count"),
        supabase.from("technician_certifications").select("id,certification_id,technician_id,status,expires_at"),
      ]);

      const error = brandsResult.error || techniciansResult.error || requirementsResult.error || recordsResult.error;
      if (error) {
        setMessage(error.message);
      } else {
        setBrands(brandsResult.data ?? []);
        setTechnicians(techniciansResult.data ?? []);
        setRequirements(requirementsResult.data ?? []);
        setRecords(recordsResult.data ?? []);
      }
      setLoading(false);
    }

    loadDashboard();
  }, [session]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    let result;
    try {
      const supabase = getSupabaseClient();
      result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to configure Supabase.");
      setAuthLoading(false);
      return;
    }

    if (result.error) setMessage(result.error.message);
    else if (mode === "signup" && !result.data.session) setMessage("Cuenta creada. Revisa tu correo para confirmarla.");
    setAuthLoading(false);
  }

  async function handleSignOut() {
    try {
      await getSupabaseClient().auth.signOut();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to configure Supabase.");
    }
  }

  const brandSummaries = useMemo<BrandSummary[]>(() => {
    return brands.map((brand) => {
      const brandRequirements = requirements.filter((item) => item.brand_id === brand.id);
      const required = brandRequirements.reduce((sum, item) => sum + item.required_count, 0);
      const covered = brandRequirements.reduce((sum, requirement) => {
        const validPeople = new Set(
          records
            .filter((record) => record.certification_id === requirement.certification_id && record.status === "valid")
            .map((record) => record.technician_id),
        ).size;
        return sum + Math.min(validPeople, requirement.required_count);
      }, 0);
      const compliance = required === 0 ? 0 : Math.round((covered / required) * 100);
      const status: BrandSummary["status"] = compliance === 100 ? "Cumplido" : compliance > 0 ? "En riesgo" : "Pendiente";
      return { id: brand.id, name: brand.name, required, covered, compliance, status };
    });
  }, [brands, requirements, records]);

  const activeBrands = brands.filter((brand) => brand.status === "active").length;
  const activeTechnicians = technicians.filter((technician) => technician.status === "active").length;
  const totalRequired = brandSummaries.reduce((sum, brand) => sum + brand.required, 0);
  const totalCovered = brandSummaries.reduce((sum, brand) => sum + brand.covered, 0);
  const generalCompliance = totalRequired === 0 ? 0 : Math.round((totalCovered / totalRequired) * 100);
  const expiringSoon = records.filter((record) => {
    if (!record.expires_at) return false;
    const days = (new Date(record.expires_at).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 90;
  }).length;
  const openGaps = Math.max(totalRequired - totalCovered, 0);

  if (loading && !session) {
    return <div className="loading-screen">Cargando CoreCert…</div>;
  }

  if (!session) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-block auth-brand"><div className="brand-mark">CORE</div><span>CoreCert</span></div>
          <p className="eyebrow">CONTROL DE CERTIFICACIONES</p>
          <h1>{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h1>
          <p className="auth-copy">Acceso interno para administrar requisitos de canal, técnicos y vigencias.</p>
          <form onSubmit={handleAuth} className="auth-form">
            <label>Correo<input name="email" type="email" required autoComplete="email" /></label>
            <label>Contraseña<input name="password" type="password" minLength={6} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
            <button disabled={authLoading}>{authLoading ? "Procesando…" : mode === "login" ? "Entrar" : "Crear cuenta"}</button>
          </form>
          {message && <p className="auth-message">{message}</p>}
          <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
            {mode === "login" ? "Crear una cuenta" : "Ya tengo una cuenta"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand-block"><div className="brand-mark">CORE</div><span>CoreCert</span></div>
        <nav>
          <a className="active"><ShieldCheck size={19}/>Resumen</a>
          <a><Building2 size={19}/>Marcas</a>
          <a><Users size={19}/>Técnicos</a>
          <a><Award size={19}/>Certificaciones</a>
          <a><FileCheck2 size={19}/>Requisitos</a>
        </nav>
        <button className="logout-button" onClick={handleSignOut}><LogOut size={17}/>Cerrar sesión</button>
        <div className="sidebar-footer">Coresolutions · Uso interno</div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">CONTROL DE CANAL</p><h1>Certificaciones</h1></div>
          <div className="top-actions">
            <div className="search"><Search size={18}/><span>Buscar</span></div>
            <button className="icon-button" aria-label="Alertas"><Bell size={19}/>{openGaps > 0 && <i />}</button>
            <div className="avatar">{session.user.email?.slice(0, 2).toUpperCase()}</div>
          </div>
        </header>

        {message && <div className="data-message">{message}</div>}

        <section className="hero-card">
          <div><span className="hero-label">CUMPLIMIENTO GENERAL</span><strong>{generalCompliance}%</strong><p>{totalCovered} de {totalRequired} cupos requeridos están cubiertos.</p></div>
          <div className="hero-progress"><span style={{ width: `${generalCompliance}%` }} /></div>
          <button>Ver brechas <ChevronRight size={17}/></button>
        </section>

        <section className="stats-grid">
          <article><span>Marcas activas</span><strong>{activeBrands}</strong><small>{brandSummaries.filter((brand) => brand.required > 0).length} con requisitos cargados</small></article>
          <article><span>Técnicos</span><strong>{activeTechnicians}</strong><small>Personal activo registrado</small></article>
          <article><span>Por vencer</span><strong>{expiringSoon}</strong><small>En los próximos 90 días</small></article>
          <article><span>Brechas abiertas</span><strong>{openGaps}</strong><small>Requieren acción</small></article>
        </section>

        <section className="main-grid">
          <div className="panel brands-panel">
            <div className="panel-heading"><div><span className="kicker">DATOS REALES</span><h2>Cumplimiento por marca</h2></div></div>
            <div className="brand-list">
              {brandSummaries.map((brand) => (
                <article className="brand-row" key={brand.id}>
                  <div className="brand-logo">{brand.name.slice(0, 2).toUpperCase()}</div>
                  <div className="brand-info"><strong>{brand.name}</strong><span>{brand.required === 0 ? "Sin requisitos cargados" : `${Math.max(brand.required - brand.covered, 0)} cupos pendientes`}</span></div>
                  <div className="requirement-count"><span>Cobertura</span><strong>{brand.covered} de {brand.required}</strong></div>
                  <div className="progress-wrap"><div><span style={{ width: `${brand.compliance}%` }}/></div><b>{brand.compliance}%</b></div>
                  <span className={`status ${brand.status.toLowerCase().replace(" ", "-")}`}>{brand.status}</span>
                  <ChevronRight size={18} className="chevron"/>
                </article>
              ))}
            </div>
          </div>

          <aside className="panel alert-panel">
            <div className="panel-heading"><div><span className="kicker">ESTADO</span><h2>Resumen</h2></div><span className="badge">{openGaps}</span></div>
            <div className="alert-list">
              <article className={`alert ${openGaps > 0 ? "critical" : "neutral"}`}><span className="alert-dot"/><div><strong>Brechas de certificación</strong><p>{openGaps > 0 ? `${openGaps} cupos requeridos todavía no están cubiertos.` : "Todos los requisitos están cubiertos."}</p></div><ChevronRight size={17}/></article>
              <article className={`alert ${expiringSoon > 0 ? "warning" : "neutral"}`}><span className="alert-dot"/><div><strong>Próximos vencimientos</strong><p>{expiringSoon} certificados vencen en los próximos 90 días.</p></div><ChevronRight size={17}/></article>
              <article className="alert neutral"><span className="alert-dot"/><div><strong>Base conectada</strong><p>Los indicadores ya se calculan desde Supabase.</p></div><ChevronRight size={17}/></article>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
