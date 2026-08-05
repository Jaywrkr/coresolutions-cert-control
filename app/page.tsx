"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Award, Bell, Building2, ChevronRight, FileCheck2, LogOut, Search, ShieldCheck, Users } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";

type Brand = { id: string; name: string; status: string };
type Technician = { id: string; full_name: string; status: string };
type Requirement = { id: string; brand_id: string; certification_id: string; required_count: number; notes: string | null };
type Certification = { id: string; brand_id: string; name: string; code: string | null; status: string };
type CertificationRecord = { id: string; certification_id: string; technician_id: string; status: string; expires_at: string | null; issued_at: string | null; certificate_number: string | null; verification_url: string | null };
type Section = "summary" | "brands" | "technicians" | "certifications" | "requirements";

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
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [records, setRecords] = useState<CertificationRecord[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("summary");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExpiringOnly, setShowExpiringOnly] = useState(false);

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

  async function loadDashboard() {
    try {
      const supabase = getSupabaseClient();
      setLoading(true);
      const [brandsResult, techniciansResult, requirementsResult, certificationsResult, recordsResult, profileResult] = await Promise.all([
        supabase.from("brands").select("id,name,status").order("name"),
        supabase.from("technicians").select("id,full_name,status").order("full_name"),
        supabase.from("brand_requirements").select("id,brand_id,certification_id,required_count,notes"),
        supabase.from("certification_catalog").select("id,brand_id,name,code,status").order("name"),
        supabase.from("technician_certifications").select("id,certification_id,technician_id,status,expires_at,issued_at,certificate_number,verification_url"),
        supabase.from("user_profiles").select("role").maybeSingle(),
      ]);
      const error = brandsResult.error || techniciansResult.error || requirementsResult.error || certificationsResult.error || recordsResult.error || profileResult.error;
      if (error) setMessage(error.message);
      else {
        setBrands(brandsResult.data ?? []);
        setTechnicians(techniciansResult.data ?? []);
        setRequirements(requirementsResult.data ?? []);
        setCertifications(certificationsResult.data ?? []);
        setRecords(recordsResult.data ?? []);
        setRole((profileResult.data as { role: string } | null)?.role ?? null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load the dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session) void loadDashboard();
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

  async function handleAddCatalogCertification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await getSupabaseClient().from("certification_catalog").insert({
      brand_id: String(form.get("brand_id")),
      name: String(form.get("name")).trim(),
      code: String(form.get("code") ?? "").trim() || null,
      status: "active",
    });
    if (result.error) setMessage(result.error.message);
    else { event.currentTarget.reset(); setMessage("Certificación agregada al catálogo."); await loadDashboard(); }
  }

  async function handleAddRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await getSupabaseClient().from("brand_requirements").insert({
      brand_id: String(form.get("brand_id")),
      certification_id: String(form.get("certification_id")),
      required_count: Number(form.get("required_count")),
      notes: String(form.get("notes") ?? "").trim() || null,
    });
    if (result.error) setMessage(result.error.message);
    else { event.currentTarget.reset(); setMessage("Requisito guardado."); await loadDashboard(); }
  }

  async function handleAddTechnicianCertification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await getSupabaseClient().from("technician_certifications").insert({
      technician_id: String(form.get("technician_id")),
      certification_id: String(form.get("certification_id")),
      issued_at: String(form.get("issued_at") || "") || null,
      expires_at: String(form.get("expires_at") || "") || null,
      certificate_number: String(form.get("certificate_number") ?? "").trim() || null,
      verification_url: String(form.get("verification_url") ?? "").trim() || null,
      status: String(form.get("status")),
    });
    if (result.error) setMessage(result.error.message);
    else { event.currentTarget.reset(); setMessage("Certificación asignada al técnico."); await loadDashboard(); }
  }

  async function editRequirement(requirement: Requirement) {
    const value = window.prompt("Cantidad de técnicos requerida", String(requirement.required_count));
    if (value === null) return;
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1) { setMessage("La cantidad debe ser un entero mayor que cero."); return; }
    const result = await getSupabaseClient().from("brand_requirements").update({ required_count: count }).eq("id", requirement.id);
    if (result.error) setMessage(result.error.message); else { setMessage("Requisito actualizado."); await loadDashboard(); }
  }

  async function deleteRequirement(requirement: Requirement) {
    if (!window.confirm("¿Eliminar este requisito?")) return;
    const result = await getSupabaseClient().from("brand_requirements").delete().eq("id", requirement.id);
    if (result.error) setMessage(result.error.message); else { setMessage("Requisito eliminado."); await loadDashboard(); }
  }

  async function editTechnicianCertification(record: CertificationRecord) {
    const expiry = window.prompt("Fecha de vencimiento (AAAA-MM-DD; déjalo vacío si no aplica)", record.expires_at ?? "");
    if (expiry === null) return;
    const result = await getSupabaseClient().from("technician_certifications").update({ expires_at: expiry.trim() || null }).eq("id", record.id);
    if (result.error) setMessage(result.error.message); else { setMessage("Certificación actualizada."); await loadDashboard(); }
  }

  async function deleteTechnicianCertification(record: CertificationRecord) {
    if (!window.confirm("¿Eliminar esta certificación del técnico?")) return;
    const result = await getSupabaseClient().from("technician_certifications").delete().eq("id", record.id);
    if (result.error) setMessage(result.error.message); else { setMessage("Certificación eliminada."); await loadDashboard(); }
  }

  const brandSummaries = useMemo<BrandSummary[]>(() => {
    return brands.map((brand) => {
      const brandRequirements = requirements.filter((item) => item.brand_id === brand.id);
      const required = brandRequirements.reduce((sum, item) => sum + item.required_count, 0);
      const covered = brandRequirements.reduce((sum, requirement) => {
        const validPeople = new Set(
          records
            .filter((record) => record.certification_id === requirement.certification_id && record.status === "active")
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
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const brandNameById = useMemo(() => new Map(brands.map((brand) => [brand.id, brand.name])), [brands]);
  const technicianNameById = useMemo(() => new Map(technicians.map((technician) => [technician.id, technician.full_name])), [technicians]);
  const certificationById = useMemo(() => new Map(certifications.map((certification) => [certification.id, certification])), [certifications]);
  const canManage = role === "admin" || role === "brand_manager";
  const visibleBrandSummaries = brandSummaries.filter((brand) => brand.name.toLocaleLowerCase().includes(normalizedQuery));
  const visibleTechnicians = technicians.filter((technician) => technician.full_name.toLocaleLowerCase().includes(normalizedQuery));
  const visibleRequirements = requirements.filter((requirement) => {
    const brandName = brandNameById.get(requirement.brand_id) ?? requirement.brand_id;
    return `${brandName} ${requirement.certification_id}`.toLocaleLowerCase().includes(normalizedQuery);
  });
  const visibleRecords = records.filter((record) => {
    const technicianName = technicianNameById.get(record.technician_id) ?? record.technician_id;
    const certificationName = certificationById.get(record.certification_id)?.name ?? record.certification_id;
    const matchesSearch = `${technicianName} ${certificationName} ${record.status}`.toLocaleLowerCase().includes(normalizedQuery);
    if (!matchesSearch) return false;
    if (!showExpiringOnly) return true;
    if (!record.expires_at) return false;
    const days = (new Date(record.expires_at).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 90;
  });
  const sectionTitles: Record<Section, string> = {
    summary: "Certificaciones",
    brands: "Marcas",
    technicians: "Técnicos",
    certifications: "Certificaciones",
    requirements: "Requisitos",
  };

  function showSection(section: Section, options?: { query?: string; expiring?: boolean }) {
    setActiveSection(section);
    setShowExpiringOnly(options?.expiring ?? false);
    if (options?.query !== undefined) setSearchQuery(options.query);
  }

  function formatDate(value: string | null) {
    return value ? new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`)) : "Sin fecha";
  }

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
          <button className={activeSection === "summary" ? "active" : ""} onClick={() => showSection("summary")}><ShieldCheck size={19}/>Resumen</button>
          <button className={activeSection === "brands" ? "active" : ""} onClick={() => showSection("brands")}><Building2 size={19}/>Marcas</button>
          <button className={activeSection === "technicians" ? "active" : ""} onClick={() => showSection("technicians")}><Users size={19}/>Técnicos</button>
          <button className={activeSection === "certifications" ? "active" : ""} onClick={() => showSection("certifications")}><Award size={19}/>Certificaciones</button>
          <button className={activeSection === "requirements" ? "active" : ""} onClick={() => showSection("requirements")}><FileCheck2 size={19}/>Requisitos</button>
        </nav>
        <button className="logout-button" onClick={handleSignOut}><LogOut size={17}/>Cerrar sesión</button>
        <div className="sidebar-footer">Coresolutions · Uso interno</div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">CONTROL DE CANAL</p><h1>{sectionTitles[activeSection]}</h1></div>
          <div className="top-actions">
            <label className="search"><Search size={18}/><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar" aria-label="Buscar en el dashboard" /></label>
            <button className="icon-button" aria-label="Ver alertas" onClick={() => showSection("requirements")}><Bell size={19}/>{openGaps > 0 && <i />}</button>
            <div className="profile-chip"><span>{canManage ? "Administrador" : "Usuario"}</span><div className="avatar">{session.user.email?.slice(0, 2).toUpperCase()}</div></div>
          </div>
        </header>

        {message && <div className="data-message">{message}</div>}

        {canManage && <section className="management-panel">
          <div><span className="kicker">ADMINISTRACIÓN</span><h2>Gestionar cumplimiento</h2><p>Configura el catálogo, requisitos por marca y certificaciones de técnicos.</p></div>
          <div className="management-actions">
            <details><summary>Nueva certificación</summary><form onSubmit={handleAddCatalogCertification} className="inline-form"><select name="brand_id" required><option value="">Marca</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select><input name="name" placeholder="Nombre de certificación" required /><input name="code" placeholder="Código (opcional)" /><button>Guardar</button></form></details>
            <details><summary>Nuevo requisito</summary><form onSubmit={handleAddRequirement} className="inline-form"><select name="brand_id" required><option value="">Marca</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select><select name="certification_id" required><option value="">Certificación</option>{certifications.filter((certification) => certification.status === "active").map((certification) => <option key={certification.id} value={certification.id}>{brandNameById.get(certification.brand_id)} · {certification.name}</option>)}</select><input name="required_count" type="number" min="1" defaultValue="1" required /><input name="notes" placeholder="Nota (opcional)" /><button>Guardar</button></form></details>
            <details><summary>Asignar a técnico</summary><form onSubmit={handleAddTechnicianCertification} className="inline-form"><select name="technician_id" required><option value="">Técnico</option>{technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.full_name}</option>)}</select><select name="certification_id" required><option value="">Certificación</option>{certifications.filter((certification) => certification.status === "active").map((certification) => <option key={certification.id} value={certification.id}>{brandNameById.get(certification.brand_id)} · {certification.name}</option>)}</select><input name="issued_at" type="date" title="Fecha de emisión" /><input name="expires_at" type="date" title="Fecha de vencimiento" /><input name="certificate_number" placeholder="N.º de certificado" /><input name="verification_url" type="url" placeholder="Enlace de evidencia" /><select name="status" defaultValue="active"><option value="active">Vigente</option><option value="expiring">Por vencer</option><option value="pending_validation">Pendiente de validar</option></select><button>Guardar</button></form></details>
          </div>
        </section>}

        {activeSection === "summary" && <>
        <section className="hero-card">
          <div><span className="hero-label">CUMPLIMIENTO GENERAL</span><strong>{generalCompliance}%</strong><p>{totalCovered} de {totalRequired} cupos requeridos están cubiertos.</p></div>
          <div className="hero-progress"><span style={{ width: `${generalCompliance}%` }} /></div>
          <button onClick={() => showSection("requirements")}>Ver brechas <ChevronRight size={17}/></button>
        </section>

        <section className="stats-grid">
          <button className="stat-card" onClick={() => showSection("brands")}><span>Marcas activas</span><strong>{activeBrands}</strong><small>{brandSummaries.filter((brand) => brand.required > 0).length} con requisitos cargados</small></button>
          <button className="stat-card" onClick={() => showSection("technicians")}><span>Técnicos</span><strong>{activeTechnicians}</strong><small>Personal activo registrado</small></button>
          <button className="stat-card" onClick={() => showSection("certifications", { expiring: true })}><span>Por vencer</span><strong>{expiringSoon}</strong><small>En los próximos 90 días</small></button>
          <button className="stat-card" onClick={() => showSection("requirements")}><span>Brechas abiertas</span><strong>{openGaps}</strong><small>Requieren acción</small></button>
        </section>
        </>}

        {activeSection === "summary" && <section className="main-grid">
          <div className="panel brands-panel">
            <div className="panel-heading"><div><span className="kicker">DATOS REALES</span><h2>Cumplimiento por marca</h2></div></div>
            <div className="brand-list">
              {visibleBrandSummaries.map((brand) => (
                <button className="brand-row row-button" key={brand.id} onClick={() => showSection("requirements", { query: brand.name })}>
                  <div className="brand-logo">{brand.name.slice(0, 2).toUpperCase()}</div>
                  <div className="brand-info"><strong>{brand.name}</strong><span>{brand.required === 0 ? "Sin requisitos cargados" : `${Math.max(brand.required - brand.covered, 0)} cupos pendientes`}</span></div>
                  <div className="requirement-count"><span>Cobertura</span><strong>{brand.covered} de {brand.required}</strong></div>
                  <div className="progress-wrap"><div><span style={{ width: `${brand.compliance}%` }}/></div><b>{brand.compliance}%</b></div>
                  <span className={`status ${brand.status.toLowerCase().replace(" ", "-")}`}>{brand.status}</span>
                  <ChevronRight size={18} className="chevron"/>
                </button>
              ))}
            </div>
          </div>

          <aside className="panel alert-panel">
            <div className="panel-heading"><div><span className="kicker">ESTADO</span><h2>Resumen</h2></div><span className="badge">{openGaps}</span></div>
            <div className="alert-list">
              <button className={`alert alert-button ${openGaps > 0 ? "critical" : "neutral"}`} onClick={() => showSection("requirements")}><span className="alert-dot"/><div><strong>Brechas de certificación</strong><p>{openGaps > 0 ? `${openGaps} cupos requeridos todavía no están cubiertos.` : "Todos los requisitos están cubiertos."}</p></div><ChevronRight size={17}/></button>
              <button className={`alert alert-button ${expiringSoon > 0 ? "warning" : "neutral"}`} onClick={() => showSection("certifications", { expiring: true })}><span className="alert-dot"/><div><strong>Próximos vencimientos</strong><p>{expiringSoon} certificados vencen en los próximos 90 días.</p></div><ChevronRight size={17}/></button>
              <button className="alert alert-button neutral" onClick={() => showSection("summary")}><span className="alert-dot"/><div><strong>Base conectada</strong><p>Los indicadores ya se calculan desde Supabase.</p></div><ChevronRight size={17}/></button>
            </div>
          </aside>
        </section>}

        {activeSection === "brands" && <section className="panel data-panel">
          <div className="panel-heading"><div><span className="kicker">CATÁLOGO</span><h2>Marcas</h2></div><span className="result-count">{visibleBrandSummaries.length} resultados</span></div>
          <div className="table-list">
            {visibleBrandSummaries.map((brand) => <button className="table-row" key={brand.id} onClick={() => showSection("requirements", { query: brand.name })}>
              <div className="brand-logo">{brand.name.slice(0, 2).toUpperCase()}</div><div><strong>{brand.name}</strong><span>ID: {brand.id}</span></div><span className={`status ${brand.status.toLowerCase().replace(" ", "-")}`}>{brand.status}</span><span>{brand.covered} de {brand.required} cupos</span><ChevronRight size={18}/>
            </button>)}
            {visibleBrandSummaries.length === 0 && <p className="empty-state">No hay marcas que coincidan con la búsqueda.</p>}
          </div>
        </section>}

        {activeSection === "technicians" && <section className="panel data-panel">
          <div className="panel-heading"><div><span className="kicker">EQUIPO</span><h2>Técnicos</h2></div><span className="result-count">{visibleTechnicians.length} resultados</span></div>
          <div className="table-list">
            {visibleTechnicians.map((technician) => <button className="table-row" key={technician.id} onClick={() => showSection("certifications", { query: technician.full_name })}>
              <div className="brand-logo">{technician.full_name.slice(0, 2).toUpperCase()}</div><div><strong>{technician.full_name}</strong><span>ID: {technician.id}</span></div><span className={`status ${technician.status === "active" ? "cumplido" : "pendiente"}`}>{technician.status}</span><span>Ver certificaciones</span><ChevronRight size={18}/>
            </button>)}
            {visibleTechnicians.length === 0 && <p className="empty-state">No hay técnicos que coincidan con la búsqueda.</p>}
          </div>
        </section>}

        {activeSection === "certifications" && <section className="panel data-panel">
          <div className="panel-heading"><div><span className="kicker">VIGENCIAS</span><h2>{showExpiringOnly ? "Próximos vencimientos" : "Certificaciones"}</h2></div><button className="text-button" onClick={() => { setShowExpiringOnly(false); setSearchQuery(""); }}>Limpiar filtros</button></div>
          <div className="table-list">
            {visibleRecords.map((record) => <article className="table-row" key={record.id}>
              <div className="brand-logo"><Award size={18}/></div><div><strong>{technicianNameById.get(record.technician_id) ?? "Técnico sin identificar"}</strong><span>{certificationById.get(record.certification_id)?.name ?? record.certification_id}</span></div><span className={`status ${record.status === "active" ? "cumplido" : "pendiente"}`}>{record.status}</span><span>Vence: {formatDate(record.expires_at)}</span>{canManage ? <div className="row-actions"><button onClick={() => editTechnicianCertification(record)}>Editar</button><button onClick={() => deleteTechnicianCertification(record)}>Eliminar</button></div> : <span />}
            </article>)}
            {visibleRecords.length === 0 && <p className="empty-state">No hay certificaciones que coincidan con los filtros actuales.</p>}
          </div>
        </section>}

        {activeSection === "requirements" && <section className="panel data-panel">
          <div className="panel-heading"><div><span className="kicker">COBERTURA</span><h2>Requisitos</h2></div><button className="text-button" onClick={() => setSearchQuery("")}>Limpiar búsqueda</button></div>
          <div className="table-list">
            {visibleRequirements.map((requirement) => <article className="table-row" key={requirement.id}>
              <div className="brand-logo"><FileCheck2 size={18}/></div><div><strong>{brandNameById.get(requirement.brand_id) ?? "Marca sin identificar"}</strong><span>{certificationById.get(requirement.certification_id)?.name ?? requirement.certification_id}</span></div><span>{requirement.required_count} cupos requeridos</span><span>{new Set(records.filter((record) => record.certification_id === requirement.certification_id && record.status === "active").map((record) => record.technician_id)).size} cubiertos</span>{canManage ? <div className="row-actions"><button onClick={() => editRequirement(requirement)}>Editar</button><button onClick={() => deleteRequirement(requirement)}>Eliminar</button></div> : <span />}
            </article>)}
            {visibleRequirements.length === 0 && <p className="empty-state">No hay requisitos que coincidan con la búsqueda.</p>}
          </div>
        </section>}
      </section>
    </main>
  );
}
