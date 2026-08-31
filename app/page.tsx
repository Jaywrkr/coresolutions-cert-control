"use client";

import { DragEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Award, Bell, ChevronRight, FileCheck2, FileWarning, GripVertical, RefreshCw, Search, Users } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";

type Brand = { id: string; name: string; slug: string; status: string; internal_owner: string | null; notes: string | null; sort_order: number };
type Technician = { id: string; full_name: string; email: string | null; job_title: string | null; area: string | null; status: string; start_date: string | null; manager_name: string | null; notes: string | null };
type Requirement = { id: string; brand_id: string; certification_id: string; required_count: number; distinct_people_required: boolean; mandatory: boolean; effective_from: string | null; effective_until: string | null; notes: string | null };
type Certification = { id: string; brand_id: string; name: string; code: string | null; certification_type: string; level: string | null; validity_months: number | null; official_url: string | null; status: string; notes: string | null };
type CertificationRecord = { id: string; certification_id: string; technician_id: string; status: string; expires_at: string | null; issued_at: string | null; certificate_number: string | null; verification_url: string | null; evidence_path: string | null; notes: string | null };
type Section = "summary" | "brands" | "technicians" | "certifications" | "requirements";

type BrandSummary = {
  id: string;
  name: string;
  internal_owner: string | null;
  required: number;
  covered: number;
  compliance: number;
  status: "Cumplido" | "En riesgo" | "Pendiente";
};

type RequirementCoverage = {
  achieved: number;
  covered: number;
  required: number;
  gap: number;
  compliance: number;
};

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
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
  const [showMissingEvidenceOnly, setShowMissingEvidenceOnly] = useState(false);
  const [selectedRequirementBrandId, setSelectedRequirementBrandId] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);
  const [selectedCertificationId, setSelectedCertificationId] = useState<string | null>(null);
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [draggedBrandId, setDraggedBrandId] = useState<string | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
  const [editingCatalogCertification, setEditingCatalogCertification] = useState<Certification | null>(null);
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [editingCertificationRecord, setEditingCertificationRecord] = useState<CertificationRecord | null>(null);
  const modalOpen = Boolean(selectedBrandId || selectedTechnicianId || selectedCertificationId || selectedRequirementId || editingBrand || editingTechnician || editingCatalogCertification || editingRequirement || editingCertificationRecord);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (searchQuery) setSearchQuery("");
      else if (selectedRequirementBrandId) setSelectedRequirementBrandId(null);
      else if (editingCertificationRecord) setEditingCertificationRecord(null);
      else if (editingRequirement) setEditingRequirement(null);
      else if (editingCatalogCertification) setEditingCatalogCertification(null);
      else if (editingTechnician) setEditingTechnician(null);
      else if (editingBrand) setEditingBrand(null);
      else if (selectedCertificationId) setSelectedCertificationId(null);
      else if (selectedBrandId) setSelectedBrandId(null);
      else if (selectedTechnicianId) setSelectedTechnicianId(null);
      else if (selectedRequirementId) setSelectedRequirementId(null);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [editingBrand, editingCatalogCertification, editingCertificationRecord, editingRequirement, editingTechnician, searchQuery, selectedBrandId, selectedCertificationId, selectedRequirementBrandId, selectedRequirementId, selectedTechnicianId]);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

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
      setRefreshing(true);
      const [brandsResult, techniciansResult, requirementsResult, certificationsResult, recordsResult, profileResult] = await Promise.all([
        supabase.from("brands").select("id,name,slug,status,internal_owner,notes,sort_order").order("sort_order").order("name"),
        supabase.from("technicians").select("id,full_name,email,job_title,area,status,start_date,manager_name,notes").order("full_name"),
        supabase.from("brand_requirements").select("id,brand_id,certification_id,required_count,distinct_people_required,mandatory,effective_from,effective_until,notes"),
        supabase.from("certification_catalog").select("id,brand_id,name,code,certification_type,level,validity_months,official_url,status,notes").order("name"),
        supabase.from("technician_certifications").select("id,certification_id,technician_id,status,expires_at,issued_at,certificate_number,verification_url,evidence_path,notes"),
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
        setLastSyncedAt(new Date());
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load the dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (session) void loadDashboard();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const supabase = getSupabaseClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void loadDashboard(), 250);
    };
    const channel = supabase
      .channel("corecert-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "brands" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "technicians" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "certification_catalog" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "brand_requirements" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "technician_certifications" }, scheduleRefresh)
      .subscribe();
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
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

  function asOptionalText(value: FormDataEntryValue | null) {
    const text = String(value ?? "").trim();
    return text || null;
  }

  function parseDateInput(value: FormDataEntryValue | null, label: string) {
    const text = String(value ?? "").trim();
    if (!text) return null;
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) throw new Error(`${label} debe tener el formato MM/DD/AAAA.`);
    const [, monthText, dayText, yearText] = match;
    const month = Number(monthText);
    const day = Number(dayText);
    const year = Number(yearText);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (month < 1 || month > 12 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error(`${label} no es una fecha válida.`);
    }
    return `${yearText}-${monthText}-${dayText}`;
  }

  function slugify(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async function handleAddBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) { setMessage("El nombre de la marca es obligatorio."); return; }
    const result = await getSupabaseClient().from("brands").insert({
      name,
      slug: slugify(name),
      internal_owner: asOptionalText(form.get("internal_owner")),
      notes: asOptionalText(form.get("notes")),
      status: String(form.get("status") || "active"),
      sort_order: brands.length + 1,
    });
    if (result.error) setMessage(result.error.message);
    else { event.currentTarget.reset(); setMessage("Marca agregada."); await loadDashboard(); }
  }

  async function saveBrandOrder(nextBrands: Brand[]) {
    setBrands(nextBrands);
    const updates = await Promise.all(nextBrands.map((brand, index) =>
      getSupabaseClient().from("brands").update({ sort_order: index + 1 }).eq("id", brand.id),
    ));
    const error = updates.find((result) => result.error)?.error;
    if (error) {
      setMessage(error.message);
      await loadDashboard();
    } else {
      setMessage("Orden de marcas actualizado.");
    }
  }

  function moveBrand(brandId: string, direction: -1 | 1) {
    const currentIndex = brands.findIndex((brand) => brand.id === brandId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= brands.length) return;
    const nextBrands = [...brands];
    [nextBrands[currentIndex], nextBrands[nextIndex]] = [nextBrands[nextIndex], nextBrands[currentIndex]];
    void saveBrandOrder(nextBrands);
  }

  function handleBrandDragStart(event: DragEvent<HTMLElement>, brandId: string) {
    if (!canManage) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", brandId);
    setDraggedBrandId(brandId);
  }

  function handleBrandDrop(event: DragEvent<HTMLElement>, targetBrandId: string) {
    event.preventDefault();
    const sourceBrandId = draggedBrandId ?? event.dataTransfer.getData("text/plain");
    setDraggedBrandId(null);
    if (!sourceBrandId || sourceBrandId === targetBrandId) return;
    const sourceIndex = brands.findIndex((brand) => brand.id === sourceBrandId);
    const targetIndex = brands.findIndex((brand) => brand.id === targetBrandId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const nextBrands = [...brands];
    const [movedBrand] = nextBrands.splice(sourceIndex, 1);
    nextBrands.splice(targetIndex, 0, movedBrand);
    void saveBrandOrder(nextBrands);
  }

  async function handleAddTechnician(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("full_name") ?? "").trim();
    if (!fullName) { setMessage("El nombre del técnico es obligatorio."); return; }
    let startDate: string | null;
    try { startDate = parseDateInput(form.get("start_date"), "La fecha de ingreso"); } catch (error) { setMessage(error instanceof Error ? error.message : "Fecha inválida."); return; }
    const result = await getSupabaseClient().from("technicians").insert({
      full_name: fullName,
      email: asOptionalText(form.get("email")),
      job_title: asOptionalText(form.get("job_title")),
      area: asOptionalText(form.get("area")),
      start_date: startDate,
      manager_name: asOptionalText(form.get("manager_name")),
      notes: asOptionalText(form.get("notes")),
      status: String(form.get("status") || "active"),
    });
    if (result.error) setMessage(result.error.message);
    else { event.currentTarget.reset(); setMessage("Técnico agregado."); await loadDashboard(); }
  }

  async function handleAddCatalogCertification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const validityValue = String(form.get("validity_months") ?? "").trim();
    const validityMonths = validityValue ? Number(validityValue) : null;
    if (!name || (validityMonths !== null && (!Number.isInteger(validityMonths) || validityMonths < 1))) {
      setMessage("Revisa el nombre y la vigencia de la certificación.");
      return;
    }
    const result = await getSupabaseClient().from("certification_catalog").insert({
      brand_id: String(form.get("brand_id")),
      name,
      code: String(form.get("code") ?? "").trim() || null,
      certification_type: String(form.get("certification_type") || "technical"),
      level: asOptionalText(form.get("level")),
      validity_months: validityMonths,
      official_url: asOptionalText(form.get("official_url")),
      notes: asOptionalText(form.get("notes")),
      status: String(form.get("status") || "active"),
    });
    if (result.error) setMessage(result.error.message);
    else { event.currentTarget.reset(); setMessage("Certificación agregada al catálogo."); await loadDashboard(); }
  }

  async function editBrand(brand: Brand) {
    setEditingBrand(brand);
  }

  async function removeBrand(brand: Brand) {
    const hasRelatedData = certifications.some((item) => item.brand_id === brand.id) || requirements.some((item) => item.brand_id === brand.id);
    if (hasRelatedData) {
      if (!window.confirm(`La marca ${brand.name} tiene certificaciones o requisitos asociados. Para conservar el historial se desactivará. ¿Continuar?`)) return;
      const result = await getSupabaseClient().from("brands").update({ status: "inactive" }).eq("id", brand.id);
      if (result.error) setMessage(result.error.message); else { setMessage("Marca desactivada; su historial se conserva."); await loadDashboard(); }
      return;
    }
    if (!window.confirm(`¿Eliminar definitivamente la marca ${brand.name}?`)) return;
    const result = await getSupabaseClient().from("brands").delete().eq("id", brand.id);
    if (result.error) setMessage(result.error.message); else { setMessage("Marca eliminada."); await loadDashboard(); }
  }

  async function editTechnician(technician: Technician) {
    setEditingTechnician(technician);
  }

  async function removeTechnician(technician: Technician) {
    const assignments = records.filter((record) => record.technician_id === technician.id).length;
    if (assignments > 0) {
      if (!window.confirm(`${technician.full_name} tiene ${assignments} certificación(es) asignada(s). Para conservar el historial se desactivará. ¿Continuar?`)) return;
      const result = await getSupabaseClient().from("technicians").update({ status: "inactive" }).eq("id", technician.id);
      if (result.error) setMessage(result.error.message); else { setMessage("Técnico desactivado; sus certificaciones se conservan."); await loadDashboard(); }
      return;
    }
    if (!window.confirm(`¿Eliminar definitivamente a ${technician.full_name}?`)) return;
    const result = await getSupabaseClient().from("technicians").delete().eq("id", technician.id);
    if (result.error) setMessage(result.error.message); else { setMessage("Técnico eliminado."); await loadDashboard(); }
  }

  async function editCatalogCertification(certification: Certification) {
    setEditingCatalogCertification(certification);
  }

  async function removeCatalogCertification(certification: Certification) {
    const assignments = records.filter((record) => record.certification_id === certification.id).length;
    const requirementCount = requirements.filter((requirement) => requirement.certification_id === certification.id).length;
    if (assignments > 0 || requirementCount > 0) {
      if (!window.confirm(`${certification.name} tiene datos asociados. Para conservar el historial se retirará del catálogo. ¿Continuar?`)) return;
      const result = await getSupabaseClient().from("certification_catalog").update({ status: "retired" }).eq("id", certification.id);
      if (result.error) setMessage(result.error.message); else { setMessage("Certificación retirada; su historial se conserva."); await loadDashboard(); }
      return;
    }
    if (!window.confirm(`¿Eliminar definitivamente la certificación ${certification.name}?`)) return;
    const result = await getSupabaseClient().from("certification_catalog").delete().eq("id", certification.id);
    if (result.error) setMessage(result.error.message); else { setMessage("Certificación eliminada."); await loadDashboard(); }
  }

  async function handleAddRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const brandId = String(form.get("brand_id"));
    const certificationName = String(form.get("certification_name") ?? "").trim();
    const requiredCount = Number(form.get("required_count"));
    if (!brandId || !certificationName) {
      setMessage("Indica la marca y el nombre de la certificación.");
      return;
    }
    if (!Number.isInteger(requiredCount) || requiredCount < 1) {
      setMessage("La cantidad debe ser un entero mayor que cero.");
      return;
    }
    let effectiveFrom: string | null;
    let effectiveUntil: string | null;
    try {
      effectiveFrom = parseDateInput(form.get("effective_from"), "La vigencia desde");
      effectiveUntil = parseDateInput(form.get("effective_until"), "La vigencia hasta");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Fecha inválida."); return; }
    if (effectiveFrom && effectiveUntil && effectiveUntil < effectiveFrom) {
      setMessage("La vigencia hasta no puede ser anterior a la vigencia desde.");
      return;
    }
    const supabase = getSupabaseClient();
    const catalogLookup = await supabase.from("certification_catalog").select("id").eq("brand_id", brandId).eq("name", certificationName).maybeSingle();
    if (catalogLookup.error) { setMessage(catalogLookup.error.message); return; }
    let certificationId = catalogLookup.data?.id;
    if (!catalogLookup.data) {
      const created = await supabase.from("certification_catalog").insert({ brand_id: brandId, name: certificationName, status: "active" }).select("id").single();
      if (created.error?.code === "23505") {
        const retryLookup = await supabase.from("certification_catalog").select("id").eq("brand_id", brandId).eq("name", certificationName).maybeSingle();
        if (retryLookup.error) { setMessage(retryLookup.error.message); return; }
        certificationId = retryLookup.data?.id;
      } else if (created.error || !created.data) {
        setMessage(created.error?.message ?? "No se pudo crear la certificación.");
        return;
      } else {
        certificationId = created.data.id;
      }
    }
    if (!certificationId) { setMessage("No se pudo recuperar la certificación."); return; }
    const requirementLookup = await supabase.from("brand_requirements").select("id").eq("brand_id", brandId).eq("certification_id", certificationId).maybeSingle();
    if (requirementLookup.error) { setMessage(requirementLookup.error.message); return; }
    const existingRequirement = requirementLookup.data;
    const requirementData = {
      required_count: requiredCount,
      distinct_people_required: form.get("distinct_people_required") === "on",
      mandatory: form.get("mandatory") === "on",
      effective_from: effectiveFrom,
      effective_until: effectiveUntil,
      notes: asOptionalText(form.get("notes")),
    };
    const result = existingRequirement
      ? await supabase.from("brand_requirements").update(requirementData).eq("id", existingRequirement.id)
      : await supabase.from("brand_requirements").insert({ brand_id: brandId, certification_id: certificationId, ...requirementData });
    if (result.error) setMessage(result.error.message);
    else { event.currentTarget.reset(); setMessage(existingRequirement ? "Cantidad del requisito actualizada." : "Requisito guardado."); await loadDashboard(); }
  }

  async function handleAddTechnicianCertification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const technicianId = String(form.get("technician_id"));
    const certificationId = String(form.get("certification_id"));
    if (!technicianId || !certificationId) { setMessage("Selecciona un técnico y una certificación."); return; }
    let issuedAt: string | null;
    let expiresAt: string | null;
    try {
      issuedAt = parseDateInput(form.get("issued_at"), "La fecha de emisión");
      expiresAt = parseDateInput(form.get("expires_at"), "La fecha de vencimiento");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Fecha inválida."); return; }
    if (issuedAt && expiresAt && expiresAt < issuedAt) { setMessage("La fecha de vencimiento no puede ser anterior a la fecha de emisión."); return; }
    const supabase = getSupabaseClient();
    const evidenceFile = form.get("certificate_file");
    let evidencePath: string | null = null;
    if (evidenceFile instanceof File && evidenceFile.size > 0) {
      const isPdf = evidenceFile.type === "application/pdf" || evidenceFile.name.toLocaleLowerCase().endsWith(".pdf");
      if (!isPdf) { setMessage("El respaldo debe ser un archivo PDF."); return; }
      if (evidenceFile.size > 10485760) { setMessage("El PDF no puede superar 10 MB."); return; }
      const safeName = evidenceFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const upload = await supabase.storage.from("certificate-files").upload(`${certificationId}/${technicianId}/${crypto.randomUUID()}-${safeName}`, evidenceFile, { contentType: "application/pdf", upsert: false });
      if (upload.error) { setMessage(upload.error.message); return; }
      evidencePath = upload.data.path;
    }
    const result = await supabase.from("technician_certifications").insert({
      technician_id: technicianId,
      certification_id: certificationId,
      issued_at: issuedAt,
      expires_at: expiresAt,
      certificate_number: String(form.get("certificate_number") ?? "").trim() || null,
      verification_url: String(form.get("verification_url") ?? "").trim() || null,
      evidence_path: evidencePath,
      notes: asOptionalText(form.get("notes")),
      status: String(form.get("status")),
    });
    if (result.error) {
      if (evidencePath) await supabase.storage.from("certificate-files").remove([evidencePath]);
      setMessage(result.error.message);
    } else {
      event.currentTarget.reset();
      setMessage(buildRegistrationMessage(certificationId, technicianId, String(form.get("status")), expiresAt, evidencePath, String(form.get("verification_url") ?? "").trim()));
      await loadDashboard();
    }
  }

  async function editRequirement(requirement: Requirement) {
    const value = window.prompt("Cantidad de técnicos requerida", String(requirement.required_count));
    if (value === null) return;
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1) { setMessage("La cantidad debe ser un entero mayor que cero."); return; }
    const result = await getSupabaseClient().from("brand_requirements").update({ required_count: count }).eq("id", requirement.id);
    if (result.error) setMessage(result.error.message); else { setMessage("Requisito actualizado."); await loadDashboard(); }
  }

  async function editFullRequirement(requirement: Requirement) {
    setEditingRequirement(requirement);
  }

  async function deleteRequirement(requirement: Requirement) {
    if (!window.confirm("¿Eliminar este requisito?")) return;
    const result = await getSupabaseClient().from("brand_requirements").delete().eq("id", requirement.id);
    if (result.error) setMessage(result.error.message); else { setMessage("Requisito eliminado."); await loadDashboard(); }
  }

  async function editTechnicianCertification(record: CertificationRecord) {
    setEditingCertificationRecord(record);
  }

  async function handleUpdateBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingBrand) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) { setMessage("El nombre de la marca es obligatorio."); return; }
    const result = await getSupabaseClient().from("brands").update({ name, slug: slugify(name), internal_owner: asOptionalText(form.get("internal_owner")), notes: asOptionalText(form.get("notes")), status: String(form.get("status")) }).eq("id", editingBrand.id);
    if (result.error) setMessage(result.error.message); else { setEditingBrand(null); setMessage("Marca actualizada."); await loadDashboard(); }
  }

  async function handleUpdateTechnician(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTechnician) return;
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("full_name") ?? "").trim();
    if (!fullName) { setMessage("El nombre del técnico es obligatorio."); return; }
    let startDate: string | null;
    try { startDate = parseDateInput(form.get("start_date"), "La fecha de ingreso"); } catch (error) { setMessage(error instanceof Error ? error.message : "Fecha inválida."); return; }
    const result = await getSupabaseClient().from("technicians").update({ full_name: fullName, email: asOptionalText(form.get("email")), job_title: asOptionalText(form.get("job_title")), area: asOptionalText(form.get("area")), start_date: startDate, manager_name: asOptionalText(form.get("manager_name")), notes: asOptionalText(form.get("notes")), status: String(form.get("status")) }).eq("id", editingTechnician.id);
    if (result.error) setMessage(result.error.message); else { setEditingTechnician(null); setMessage("Técnico actualizado."); await loadDashboard(); }
  }

  async function handleUpdateCatalogCertification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCatalogCertification) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const validityValue = String(form.get("validity_months") ?? "").trim();
    const validityMonths = validityValue ? Number(validityValue) : null;
    if (!name || (validityMonths !== null && (!Number.isInteger(validityMonths) || validityMonths < 1))) { setMessage("Revisa el nombre y la vigencia de la certificación."); return; }
    const result = await getSupabaseClient().from("certification_catalog").update({ brand_id: String(form.get("brand_id")), name, code: asOptionalText(form.get("code")), certification_type: String(form.get("certification_type")), level: asOptionalText(form.get("level")), validity_months: validityMonths, official_url: asOptionalText(form.get("official_url")), notes: asOptionalText(form.get("notes")), status: String(form.get("status")) }).eq("id", editingCatalogCertification.id);
    if (result.error) setMessage(result.error.message); else { setEditingCatalogCertification(null); setMessage("Certificación actualizada."); await loadDashboard(); }
  }

  async function handleUpdateRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRequirement) return;
    const form = new FormData(event.currentTarget);
    const brandId = String(form.get("brand_id"));
    const certificationName = String(form.get("certification_name") ?? "").trim();
    const requiredCount = Number(form.get("required_count"));
    const certification = certifications.find((item) => item.brand_id === brandId && item.name.toLocaleLowerCase() === certificationName.toLocaleLowerCase());
    if (!certification || !Number.isInteger(requiredCount) || requiredCount < 1) { setMessage("Indica una certificación válida de la marca y una cantidad correcta."); return; }
    let effectiveFrom: string | null;
    let effectiveUntil: string | null;
    try {
      effectiveFrom = parseDateInput(form.get("effective_from"), "La vigencia desde");
      effectiveUntil = parseDateInput(form.get("effective_until"), "La vigencia hasta");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Fecha inválida."); return; }
    if (effectiveFrom && effectiveUntil && effectiveUntil < effectiveFrom) { setMessage("La vigencia hasta no puede ser anterior a la vigencia desde."); return; }
    const result = await getSupabaseClient().from("brand_requirements").update({ brand_id: brandId, certification_id: certification.id, required_count: requiredCount, distinct_people_required: form.get("distinct_people_required") === "on", mandatory: form.get("mandatory") === "on", effective_from: effectiveFrom, effective_until: effectiveUntil, notes: asOptionalText(form.get("notes")) }).eq("id", editingRequirement.id);
    if (result.error) setMessage(result.error.message); else { setEditingRequirement(null); setMessage("Requisito actualizado."); await loadDashboard(); }
  }

  async function handleUpdateCertificationRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCertificationRecord) return;
    const form = new FormData(event.currentTarget);
    const technicianId = String(form.get("technician_id"));
    const certificationId = String(form.get("certification_id"));
    let issuedAt: string | null;
    let expiresAt: string | null;
    try {
      issuedAt = parseDateInput(form.get("issued_at"), "La fecha de emisión");
      expiresAt = parseDateInput(form.get("expires_at"), "La fecha de vencimiento");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Fecha inválida."); return; }
    if (issuedAt && expiresAt && expiresAt < issuedAt) { setMessage("La fecha de vencimiento no puede ser anterior a la fecha de emisión."); return; }
    const supabase = getSupabaseClient();
    const evidenceFile = form.get("certificate_file");
    let evidencePath = editingCertificationRecord.evidence_path;
    let uploadedPath: string | null = null;
    if (evidenceFile instanceof File && evidenceFile.size > 0) {
      const isPdf = evidenceFile.type === "application/pdf" || evidenceFile.name.toLocaleLowerCase().endsWith(".pdf");
      if (!isPdf || evidenceFile.size > 10485760) { setMessage("Adjunta un PDF de hasta 10 MB."); return; }
      const safeName = evidenceFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const upload = await supabase.storage.from("certificate-files").upload(`${certificationId}/${technicianId}/${crypto.randomUUID()}-${safeName}`, evidenceFile, { contentType: "application/pdf", upsert: false });
      if (upload.error) { setMessage(upload.error.message); return; }
      uploadedPath = upload.data.path;
      evidencePath = uploadedPath;
    }
    const result = await supabase.from("technician_certifications").update({ technician_id: technicianId, certification_id: certificationId, issued_at: issuedAt, expires_at: expiresAt, certificate_number: asOptionalText(form.get("certificate_number")), verification_url: asOptionalText(form.get("verification_url")), notes: asOptionalText(form.get("notes")), status: String(form.get("status")), evidence_path: evidencePath }).eq("id", editingCertificationRecord.id);
    if (result.error) {
      if (uploadedPath) await supabase.storage.from("certificate-files").remove([uploadedPath]);
      setMessage(result.error.message);
    } else {
      if (uploadedPath && editingCertificationRecord.evidence_path) await supabase.storage.from("certificate-files").remove([editingCertificationRecord.evidence_path]);
      setEditingCertificationRecord(null); setMessage("Certificación actualizada."); await loadDashboard();
    }
  }

  async function deleteTechnicianCertification(record: CertificationRecord) {
    if (!window.confirm("¿Eliminar esta certificación del técnico?")) return;
    const result = await getSupabaseClient().from("technician_certifications").delete().eq("id", record.id);
    if (result.error) setMessage(result.error.message); else {
      if (record.evidence_path) await getSupabaseClient().storage.from("certificate-files").remove([record.evidence_path]);
      setMessage("Certificación eliminada."); await loadDashboard();
    }
  }

  async function openCertificateEvidence(record: CertificationRecord) {
    if (record.evidence_path) {
      const signedFile = await getSupabaseClient().storage.from("certificate-files").createSignedUrl(record.evidence_path, 300);
      if (signedFile.error || !signedFile.data?.signedUrl) { setMessage(signedFile.error?.message ?? "No se pudo abrir el PDF."); return; }
      window.open(signedFile.data.signedUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (record.verification_url) {
      const url = getSafeExternalUrl(record.verification_url);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      setMessage("El enlace de evidencia no es válido. Edítalo para usar una dirección HTTP o HTTPS.");
      return;
    }
    setMessage("Esta certificación no tiene un PDF ni enlace de respaldo.");
  }

  function getSafeExternalUrl(value: string | null) {
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
    } catch {
      return null;
    }
  }

  function isRecordCurrent(record: CertificationRecord) {
    if (record.status !== "active" && record.status !== "expiring") return false;
    if (!record.expires_at) return true;
    const today = new Date();
    const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return record.expires_at >= localToday;
  }

  function getRequirementCoverage(requirement: Requirement): RequirementCoverage {
    const qualifyingRecords = records.filter((record) => record.certification_id === requirement.certification_id && isRecordCurrent(record));
    const achieved = requirement.distinct_people_required
      ? new Set(qualifyingRecords.map((record) => record.technician_id)).size
      : qualifyingRecords.length;
    const covered = Math.min(achieved, requirement.required_count);
    const gap = Math.max(requirement.required_count - covered, 0);
    const compliance = requirement.required_count === 0 ? 0 : Math.round((covered / requirement.required_count) * 100);
    return { achieved, covered, required: requirement.required_count, gap, compliance };
  }

  function buildRegistrationMessage(certificationId: string, technicianId: string, status: string, expiresAt: string | null, evidencePath: string | null, verificationUrl: string) {
    const technicianName = technicianNameById.get(technicianId) ?? "el técnico";
    const certificationName = certificationById.get(certificationId)?.name ?? "la certificación";
    const requirement = requirements.find((item) => item.certification_id === certificationId);
    const today = new Date();
    const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const countsNow = (status === "active" || status === "expiring") && (!expiresAt || expiresAt >= localToday);
    const evidenceNote = evidencePath || verificationUrl ? " Evidencia registrada." : " Se marcará como pendiente de evidencia.";
    if (!requirement) return `Certificación registrada para ${technicianName}.${evidenceNote}`;
    const coverage = getRequirementCoverage(requirement);
    const alreadyCounted = requirement.distinct_people_required && records.some((record) => record.certification_id === certificationId && record.technician_id === technicianId && isRecordCurrent(record));
    const projectedAchieved = countsNow && !alreadyCounted ? coverage.achieved + 1 : coverage.achieved;
    const projectedCovered = Math.min(projectedAchieved, requirement.required_count);
    const impact = countsNow && !alreadyCounted
      ? `${certificationName} queda ${projectedCovered} de ${requirement.required_count} cupos cubiertos.`
      : "El registro no modifica la cobertura vigente de este requisito.";
    return `Certificación registrada para ${technicianName}. ${impact}${evidenceNote}`;
  }

  function getRecordPresentation(record: CertificationRecord) {
    if (record.status === "pending_validation") return { label: "Pendiente de validar", className: "pendiente" };
    if (!isRecordCurrent(record)) return { label: "Vencida", className: "pendiente" };
    if (record.status === "expiring") return { label: "Por vencer", className: "en-riesgo" };
    return { label: "Vigente", className: "cumplido" };
  }

  function getEntityStatusPresentation(status: string, feminine = false) {
    const labels: Record<string, string> = {
      active: feminine ? "Activa" : "Activo",
      inactive: feminine ? "Inactiva" : "Inactivo",
      review: "En revisión",
      leave: "Ausente",
      retired: "Retirada",
    };
    return {
      label: labels[status] ?? status,
      className: status === "active" ? "cumplido" : status === "review" || status === "leave" ? "en-riesgo" : "pendiente",
    };
  }

  const brandSummaries = useMemo<BrandSummary[]>(() => {
    return brands.map((brand) => {
      const brandRequirements = requirements.filter((item) => item.brand_id === brand.id);
      const required = brandRequirements.reduce((sum, item) => sum + item.required_count, 0);
      const covered = brandRequirements.reduce((sum, requirement) => sum + getRequirementCoverage(requirement).covered, 0);
      const compliance = required === 0 ? 0 : Math.round((covered / required) * 100);
      const status: BrandSummary["status"] = compliance === 100 ? "Cumplido" : compliance > 0 ? "En riesgo" : "Pendiente";
      return { id: brand.id, name: brand.name, internal_owner: brand.internal_owner, required, covered, compliance, status };
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
  const currentRecordsWithoutEvidence = records.filter((record) => isRecordCurrent(record) && !record.evidence_path && !record.verification_url).length;
  const openGaps = Math.max(totalRequired - totalCovered, 0);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const brandNameById = useMemo(() => new Map(brands.map((brand) => [brand.id, brand.name])), [brands]);
  const technicianNameById = useMemo(() => new Map(technicians.map((technician) => [technician.id, technician.full_name])), [technicians]);
  const certificationById = useMemo(() => new Map(certifications.map((certification) => [certification.id, certification])), [certifications]);
  const canManage = role === "admin" || role === "brand_manager";
  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId) ?? null;
  const selectedBrandSummary = brandSummaries.find((brand) => brand.id === selectedBrandId) ?? null;
  const selectedTechnician = technicians.find((technician) => technician.id === selectedTechnicianId) ?? null;
  const selectedCertification = certifications.find((certification) => certification.id === selectedCertificationId) ?? null;
  const selectedRequirement = requirements.find((requirement) => requirement.id === selectedRequirementId) ?? null;
  const selectedCertificationRequirement = selectedCertification ? requirements.find((requirement) => requirement.certification_id === selectedCertification.id) ?? null : null;
  const visibleBrandSummaries = brandSummaries.filter((brand) => `${brand.name} ${brand.internal_owner ?? ""}`.toLocaleLowerCase().includes(normalizedQuery));
  const visibleTechnicians = technicians.filter((technician) => `${technician.full_name} ${technician.email ?? ""} ${technician.job_title ?? ""} ${technician.area ?? ""} ${technician.manager_name ?? ""}`.toLocaleLowerCase().includes(normalizedQuery));
  const requirementBrandCounts = requirements.reduce((counts, requirement) => {
    counts.set(requirement.brand_id, (counts.get(requirement.brand_id) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const requirementBrands = brands.filter((brand) => requirementBrandCounts.has(brand.id));
  const visibleRequirements = requirements.filter((requirement) => {
    if (selectedRequirementBrandId && requirement.brand_id !== selectedRequirementBrandId) return false;
    const brandName = brandNameById.get(requirement.brand_id) ?? requirement.brand_id;
    const certification = certificationById.get(requirement.certification_id);
    return `${brandName} ${certification?.name ?? ""} ${certification?.code ?? ""} ${requirement.notes ?? ""}`.toLocaleLowerCase().includes(normalizedQuery);
  });
  const visibleCatalog = certifications.filter((certification) => {
    const brandName = brandNameById.get(certification.brand_id) ?? certification.brand_id;
    return `${brandName} ${certification.name} ${certification.code ?? ""} ${certification.status}`.toLocaleLowerCase().includes(normalizedQuery);
  });
  const visibleRecords = records.filter((record) => {
    const technicianName = technicianNameById.get(record.technician_id) ?? record.technician_id;
    const certificationName = certificationById.get(record.certification_id)?.name ?? record.certification_id;
    const matchesSearch = `${technicianName} ${certificationName} ${record.status} ${record.certificate_number ?? ""} ${record.notes ?? ""}`.toLocaleLowerCase().includes(normalizedQuery);
    if (!matchesSearch) return false;
    if (showMissingEvidenceOnly) return isRecordCurrent(record) && !record.evidence_path && !record.verification_url;
    if (!showExpiringOnly) return true;
    if (!record.expires_at) return false;
    const days = (new Date(record.expires_at).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 90;
  });
  const searchFilterLabel = searchQuery ? `Búsqueda: “${searchQuery}”` : null;
  const sectionTitles: Record<Section, string> = {
    summary: "Certificaciones",
    brands: "Marcas",
    technicians: "Técnicos",
    certifications: "Certificaciones",
    requirements: "Requisitos",
  };

  function showSection(section: Section, options?: { expiring?: boolean; missingEvidence?: boolean }) {
    setActiveSection(section);
    setShowExpiringOnly(options?.expiring ?? false);
    setShowMissingEvidenceOnly(options?.missingEvidence ?? false);
    setSelectedRequirementBrandId(null);
    setSelectedBrandId(null);
    setSelectedTechnicianId(null);
    setSelectedCertificationId(null);
    setSelectedRequirementId(null);
    setSearchQuery("");
  }

  function clearRequirementFilters() {
    setSearchQuery("");
    setSelectedRequirementBrandId(null);
  }

  function openBrand(brandId: string) {
    setShowExpiringOnly(false);
    setShowMissingEvidenceOnly(false);
    setSearchQuery("");
    setSelectedTechnicianId(null);
    setSelectedCertificationId(null);
    setSelectedRequirementId(null);
    setSelectedBrandId(brandId);
  }

  function openTechnician(technicianId: string) {
    setActiveSection("technicians");
    setShowExpiringOnly(false);
    setShowMissingEvidenceOnly(false);
    setSearchQuery("");
    setSelectedBrandId(null);
    setSelectedCertificationId(null);
    setSelectedRequirementId(null);
    setSelectedTechnicianId(technicianId);
  }

  function openCertification(certificationId: string) {
    setSelectedBrandId(null);
    setSelectedTechnicianId(null);
    setSelectedRequirementId(null);
    setSelectedCertificationId(certificationId);
  }

  function openRequirement(requirementId: string) {
    setActiveSection("summary");
    setShowExpiringOnly(false);
    setShowMissingEvidenceOnly(false);
    setSearchQuery("");
    setSelectedBrandId(null);
    setSelectedTechnicianId(null);
    setSelectedCertificationId(null);
    setSelectedRequirementId(requirementId);
  }

  function closeBrand() {
    setSelectedCertificationId(null);
    setSelectedBrandId(null);
  }

  function activateRow(event: ReactKeyboardEvent<HTMLElement>, action: () => void) {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    action();
  }

  function formatDate(value: string | null) {
    if (!value) return "Sin fecha";
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[2]}/${match[3]}/${match[1]}` : value;
  }

  function formatSyncTime(value: Date | null) {
    if (!value) return "Sincronizando datos…";
    return `Actualizado ${new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit" }).format(value)}`;
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
      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">CONTROL DE CANAL</p><h1>{sectionTitles[activeSection]}</h1></div>
          <div className="top-actions">
            <div className="search"><Search size={18}/><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={`Buscar en ${sectionTitles[activeSection].toLocaleLowerCase()}`} aria-label={`Buscar en ${sectionTitles[activeSection]}`} />{searchQuery && <button type="button" className="clear-search" onClick={() => setSearchQuery("")} aria-label="Limpiar búsqueda">Limpiar</button>}</div>
            <div className="data-freshness" role="status" aria-live="polite"><span className={refreshing ? "sync-indicator syncing" : "sync-indicator"}/>{refreshing ? "Actualizando…" : formatSyncTime(lastSyncedAt)}</div>
            <button type="button" className="icon-button" aria-label="Actualizar datos" title="Actualizar datos" disabled={refreshing} onClick={() => void loadDashboard()}><RefreshCw size={18} className={refreshing ? "spin" : ""}/></button>
            <button type="button" className="icon-button" aria-label="Ver alertas" title="Ver alertas" onClick={() => showSection("requirements")}><Bell size={19}/>{openGaps > 0 && <i />}</button>
            <div className="profile-chip"><span>{canManage ? "Administrador" : "Usuario"}</span><div className="avatar">{session.user.email?.slice(0, 2).toUpperCase()}</div></div>
          </div>
        </header>

        {message && <div className="data-message" role="status" aria-live="assertive"><span>{message}</span><button type="button" onClick={() => setMessage("")}>Cerrar</button></div>}

        {activeSection === "summary" && <>
        <section className="hero-card">
          <div><span className="hero-label">CUMPLIMIENTO GENERAL</span><strong>{generalCompliance}%</strong><p>{totalCovered} de {totalRequired} cupos requeridos están cubiertos.</p></div>
          <div className="hero-progress"><span style={{ width: `${generalCompliance}%` }} /></div>
          <button type="button" onClick={() => showSection("requirements")}>Ver brechas <ChevronRight size={17}/></button>
        </section>

        <section className="stats-grid">
          <button type="button" className="stat-card" onClick={() => document.getElementById("brand-compliance")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span>Marcas activas</span><strong>{activeBrands}</strong><small>{brandSummaries.filter((brand) => brand.required > 0).length} con requisitos cargados · Ver en dashboard</small></button>
          <button className="stat-card" onClick={() => showSection("technicians")}><span>Técnicos</span><strong>{activeTechnicians}</strong><small>Personal activo registrado</small></button>
          <button className="stat-card" onClick={() => showSection("certifications", { expiring: true })}><span>Por vencer</span><strong>{expiringSoon}</strong><small>En los próximos 90 días</small></button>
          <button className="stat-card" onClick={() => showSection("requirements")}><span>Brechas abiertas</span><strong>{openGaps}</strong><small>Requieren acción</small></button>
        </section>
        <section className="dashboard-shortcuts" aria-label="Accesos rápidos"><div><span className="kicker">GESTIÓN</span><strong>Accesos rápidos</strong><small>Administra cada dato desde su contexto, sin perder el resumen.</small></div><div className="shortcut-actions"><button type="button" onClick={() => showSection("technicians")}><Users size={16}/>Técnicos</button><button type="button" onClick={() => showSection("certifications")}><Award size={16}/>Certificaciones</button><button type="button" onClick={() => showSection("requirements")}><FileCheck2 size={16}/>Requisitos</button></div></section>
        </>}

        {activeSection === "summary" && <section className="main-grid">
          <div id="brand-compliance" className="panel brands-panel">
            <div className="panel-heading"><div><span className="kicker">DATOS REALES</span><h2>Cumplimiento por marca</h2></div></div>
            <div className="brand-list">
              {visibleBrandSummaries.map((brand) => (
                <button className="brand-row row-button" key={brand.id} onClick={() => openBrand(brand.id)}>
                  <div className="brand-logo">{brand.name.slice(0, 2).toUpperCase()}</div>
                  <div className="brand-info"><strong>{brand.name}</strong><span>{brand.required === 0 ? "Sin requisitos cargados" : brand.covered === brand.required ? "Requisitos cubiertos" : `${Math.max(brand.required - brand.covered, 0)} cupos pendientes`}</span></div>
                  <div className="requirement-count"><span>Cobertura</span><strong>{brand.covered} de {brand.required}</strong></div>
                  <div className="progress-wrap"><div><span style={{ width: `${brand.compliance}%` }}/></div><b>{brand.compliance}%</b></div>
                  <span className={`status ${brand.status.toLowerCase().replace(" ", "-")}`}>{brand.status}</span>
                  <ChevronRight size={18} className="chevron"/>
                </button>
              ))}
            </div>
          </div>

          <aside className="panel alert-panel">
            <div className="panel-heading"><div><span className="kicker">PRIORIDAD OPERATIVA</span><h2>Atención requerida</h2></div><span className="badge">{openGaps + expiringSoon + currentRecordsWithoutEvidence}</span></div>
            <div className="alert-list">
              <button className={`alert alert-button ${openGaps > 0 ? "critical" : "neutral"}`} onClick={() => showSection("requirements")}><span className="alert-dot"/><div><strong>Resolver brechas</strong><p>{openGaps > 0 ? `${openGaps} cupos requeridos todavía no están cubiertos.` : "No hay brechas abiertas."}</p><small>Ver requisitos y cobertura</small></div><ChevronRight size={17}/></button>
              <button className={`alert alert-button ${expiringSoon > 0 ? "warning" : "neutral"}`} onClick={() => showSection("certifications", { expiring: true })}><span className="alert-dot"/><div><strong>Revisar vencimientos</strong><p>{expiringSoon > 0 ? `${expiringSoon} certificados vencen en los próximos 90 días.` : "No hay vencimientos próximos."}</p><small>Ver certificados por vencer</small></div><ChevronRight size={17}/></button>
              <button className={`alert alert-button ${currentRecordsWithoutEvidence > 0 ? "warning" : "neutral"}`} onClick={() => showSection("certifications", { missingEvidence: true })}><span className="alert-dot"/><div><strong>Completar evidencia</strong><p>{currentRecordsWithoutEvidence > 0 ? `${currentRecordsWithoutEvidence} certificados vigentes no tienen PDF ni enlace.` : "Toda la evidencia vigente está registrada."}</p><small>Ver evidencia pendiente</small></div><ChevronRight size={17}/></button>
            </div>
          </aside>
        </section>}

        {activeSection === "brands" && canManage && <section className="management-panel contextual-management">
          <div><span className="kicker">ADMINISTRACIÓN DE MARCAS</span><h2>Agregar una marca</h2><p>Registra las marcas con su responsable interno y notas de contexto.</p></div>
          <div className="management-actions"><details><summary>Nueva marca</summary><form onSubmit={handleAddBrand} className="inline-form"><input name="name" placeholder="Nombre de la marca" required /><input name="internal_owner" placeholder="Responsable interno" /><select name="status" defaultValue="active"><option value="active">Activa</option><option value="inactive">Inactiva</option><option value="review">En revisión</option></select><input name="notes" placeholder="Notas u observaciones (opcional)" /><button>Guardar marca</button></form></details></div>
        </section>}

        {activeSection === "brands" && <section className="panel data-panel">
          <div className="panel-heading"><div><span className="kicker">CATÁLOGO</span><h2>Marcas</h2></div><div className="panel-meta"><span className="result-count">{visibleBrandSummaries.length} resultados</span>{searchFilterLabel && <span className="filter-chip">{searchFilterLabel}</span>}</div></div>
          <div className="table-list">
            {visibleBrandSummaries.map((brand) => <article className={`table-row draggable-row ${selectedBrandId === brand.id ? "selected-row" : ""}`} key={brand.id} draggable={canManage} role="button" tabIndex={0} aria-label={`Abrir detalle de ${brand.name}`} onClick={() => setSelectedBrandId(brand.id)} onKeyDown={(event) => activateRow(event, () => setSelectedBrandId(brand.id))} onDragStart={(event) => handleBrandDragStart(event, brand.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleBrandDrop(event, brand.id)} onDragEnd={() => setDraggedBrandId(null)}>
              <div className="brand-logo">{canManage ? <GripVertical size={18} /> : brand.name.slice(0, 2).toUpperCase()}</div><div><strong>{brand.name}</strong><span>{brand.internal_owner ?? "Sin responsable"}</span></div><span className={`status ${getEntityStatusPresentation(brand.status, true).className}`}>{getEntityStatusPresentation(brand.status, true).label}</span><span>{brand.required > 0 ? `${brand.covered} de ${brand.required} cubiertos` : "Sin requisitos"}</span>{canManage ? <div className="row-actions reorder-actions"><button aria-label={`Subir ${brand.name}`} disabled={brands.findIndex((item) => item.id === brand.id) === 0} onClick={(event) => { event.stopPropagation(); moveBrand(brand.id, -1); }}><ArrowUp size={15}/></button><button aria-label={`Bajar ${brand.name}`} disabled={brands.findIndex((item) => item.id === brand.id) === brands.length - 1} onClick={(event) => { event.stopPropagation(); moveBrand(brand.id, 1); }}><ArrowDown size={15}/></button><button onClick={(event) => { event.stopPropagation(); editBrand(brands.find((item) => item.id === brand.id)!); }}>Editar</button><button onClick={(event) => { event.stopPropagation(); removeBrand(brands.find((item) => item.id === brand.id)!); }}>Eliminar</button></div> : <button className="text-button" onClick={(event) => { event.stopPropagation(); openBrand(brand.id); }}>Abrir marca</button>}
            </article>)}
            {visibleBrandSummaries.length === 0 && <div className="empty-state"><strong>No encontramos marcas con esos criterios.</strong><p>{searchQuery ? "Limpia la búsqueda para volver a ver todo el catálogo." : "Cuando registres una marca aparecerá aquí."}</p>{searchQuery && <button type="button" className="text-button" onClick={() => setSearchQuery("")}>Limpiar búsqueda</button>}</div>}
          </div>
        </section>}

        {activeSection === "technicians" && canManage && <section className="management-panel contextual-management">
          <div><span className="kicker">ADMINISTRACIÓN DE TÉCNICOS</span><h2>Agregar un técnico</h2><p>Registra al personal con sus datos de contacto, cargo, área y responsable.</p></div>
          <div className="management-actions"><details><summary>Nuevo técnico</summary><form onSubmit={handleAddTechnician} className="inline-form"><input name="full_name" placeholder="Nombre completo" required /><input name="email" type="email" placeholder="Correo (opcional)" /><input name="job_title" placeholder="Cargo (opcional)" /><input name="area" placeholder="Área (opcional)" /><input name="start_date" placeholder="MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" title="Fecha de ingreso (MM/DD/AAAA)" maxLength={10} /><input name="manager_name" placeholder="Responsable (opcional)" /><select name="status" defaultValue="active"><option value="active">Activo</option><option value="inactive">Inactivo</option><option value="leave">Ausente</option></select><input name="notes" placeholder="Notas u observaciones (opcional)" /><button>Guardar técnico</button></form></details></div>
        </section>}

        {activeSection === "technicians" && <section className="panel data-panel">
          <div className="panel-heading"><div><span className="kicker">EQUIPO</span><h2>Técnicos</h2></div><div className="panel-meta"><span className="result-count">{visibleTechnicians.length} resultados</span>{searchFilterLabel && <span className="filter-chip">{searchFilterLabel}</span>}</div></div>
          <div className="table-list">
            {visibleTechnicians.map((technician) => <article className={`table-row selectable-row ${selectedTechnicianId === technician.id ? "selected-row" : ""}`} key={technician.id} role="button" tabIndex={0} aria-label={`Abrir ficha de ${technician.full_name}`} onClick={() => openTechnician(technician.id)} onKeyDown={(event) => activateRow(event, () => openTechnician(technician.id))}>
              <div className="brand-logo">{technician.full_name.slice(0, 2).toUpperCase()}</div><div><strong>{technician.full_name}</strong><span>{technician.email ?? technician.job_title ?? "Sin datos de contacto"}</span></div><span className={`status ${getEntityStatusPresentation(technician.status).className}`}>{getEntityStatusPresentation(technician.status).label}</span><span>{technician.area ?? "Sin área"}</span>{canManage ? <div className="row-actions"><button onClick={(event) => { event.stopPropagation(); editTechnician(technician); }}>Editar</button><button onClick={(event) => { event.stopPropagation(); removeTechnician(technician); }}>Eliminar</button></div> : <button className="text-button" onClick={(event) => { event.stopPropagation(); openTechnician(technician.id); }}>Abrir ficha</button>}
            </article>)}
            {visibleTechnicians.length === 0 && <div className="empty-state"><strong>No encontramos técnicos con esos criterios.</strong><p>{searchQuery ? "Limpia la búsqueda para volver a ver el equipo completo." : "Registra el primer técnico para asignarle certificaciones."}</p>{searchQuery && <button type="button" className="text-button" onClick={() => setSearchQuery("")}>Limpiar búsqueda</button>}</div>}
          </div>
        </section>}

        {activeSection === "certifications" && canManage && <section className="management-panel contextual-management">
          <div><span className="kicker">ADMINISTRACIÓN DE CERTIFICACIONES</span><h2>Catálogo y asignaciones</h2><p>Crea certificaciones por marca y asígnalas al técnico que ya las posee.</p><p className="form-guidance">Al registrar una certificación, indica primero el técnico, luego las fechas y finalmente la evidencia. El PDF es opcional, pero se marcará como pendiente si no agregas PDF ni enlace.</p></div>
          <div className="management-actions">
            <details><summary>Nueva certificación</summary><form onSubmit={handleAddCatalogCertification} className="inline-form"><select name="brand_id" required><option value="">Marca</option>{brands.filter((brand) => brand.status === "active").map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select><input name="name" placeholder="Nombre de certificación" required /><input name="code" placeholder="Código (opcional)" /><select name="certification_type" defaultValue="technical"><option value="technical">Técnica</option><option value="sales">Ventas</option><option value="presales">Preventas</option><option value="implementation">Implementación</option><option value="support">Soporte</option><option value="architecture">Arquitectura</option><option value="other">Otra</option></select><input name="level" placeholder="Nivel (opcional)" /><input name="validity_months" type="number" min="1" placeholder="Vigencia en meses" /><input name="official_url" type="url" placeholder="URL oficial (opcional)" /><select name="status" defaultValue="active"><option value="active">Activa</option><option value="inactive">Inactiva</option><option value="retired">Retirada</option></select><input name="notes" placeholder="Observación (opcional)" /><button>Guardar certificación</button></form></details>
            <details><summary>Asignar a técnico</summary><form onSubmit={handleAddTechnicianCertification} className="inline-form"><select name="technician_id" required><option value="">Técnico</option>{technicians.filter((technician) => technician.status === "active").map((technician) => <option key={technician.id} value={technician.id}>{technician.full_name}</option>)}</select><select name="certification_id" required><option value="">Certificación</option>{certifications.filter((certification) => certification.status === "active").map((certification) => <option key={certification.id} value={certification.id}>{brandNameById.get(certification.brand_id)} · {certification.name}</option>)}</select><input name="issued_at" placeholder="Emisión MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} /><input name="expires_at" placeholder="Vencimiento MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} /><input name="certificate_number" placeholder="N.º de certificado" /><input name="notes" placeholder="Observación (opcional)" /><input name="certificate_file" type="file" accept="application/pdf" title="PDF del certificado" /><input name="verification_url" type="url" placeholder="Enlace de evidencia" /><select name="status" defaultValue="active"><option value="active">Vigente</option><option value="expiring">Por vencer</option><option value="pending_validation">Pendiente de validar</option></select><button>Guardar asignación</button></form></details>
          </div>
        </section>}

        {activeSection === "certifications" && <section className="panel data-panel">
          <div className="panel-heading"><div><span className="kicker">VIGENCIAS</span><h2>{showExpiringOnly ? "Próximos vencimientos" : showMissingEvidenceOnly ? "Evidencia pendiente" : "Certificaciones"}</h2></div><div className="panel-meta">{showExpiringOnly && <span className="filter-chip">Vence en 90 días</span>}{showMissingEvidenceOnly && <span className="filter-chip">Sin evidencia</span>}{searchFilterLabel && <span className="filter-chip">{searchFilterLabel}</span>}{(showExpiringOnly || showMissingEvidenceOnly || searchQuery) && <button className="text-button" onClick={() => { setShowExpiringOnly(false); setShowMissingEvidenceOnly(false); setSearchQuery(""); }}>Limpiar filtros</button>}</div></div>
          <div className="table-list">
            {canManage && <>
              <div className="panel-heading"><span className="kicker">CATÁLOGO ADMINISTRABLE</span><strong>{visibleCatalog.length} certificaciones</strong></div>
              {visibleCatalog.map((certification) => <article className={`table-row catalog-row selectable-row ${selectedCertificationId === certification.id ? "selected-row" : ""}`} key={certification.id} role="button" tabIndex={0} aria-label={`Abrir detalle de ${certification.name}`} onClick={() => openCertification(certification.id)} onKeyDown={(event) => activateRow(event, () => openCertification(certification.id))}>
                <div className="brand-logo"><Award size={18}/></div><div><strong>{certification.name}</strong><span>{brandNameById.get(certification.brand_id) ?? "Marca sin identificar"} · {certification.code ?? "Sin código"}</span></div><span className={`status ${getEntityStatusPresentation(certification.status, true).className}`}>{getEntityStatusPresentation(certification.status, true).label}</span><span>{certification.validity_months ? `${certification.validity_months} meses de vigencia` : certification.level ?? "Sin vigencia definida"}</span><div className="row-actions"><button onClick={(event) => { event.stopPropagation(); editCatalogCertification(certification); }}>Editar</button><button onClick={(event) => { event.stopPropagation(); removeCatalogCertification(certification); }}>Eliminar</button></div>
              </article>)}
              {visibleCatalog.length === 0 && <div className="empty-state"><strong>No encontramos certificaciones de catálogo.</strong><p>{searchQuery ? "Prueba con otra búsqueda o limpia el filtro actual." : "Crea una certificación para asociarla a una marca."}</p>{searchQuery && <button type="button" className="text-button" onClick={() => setSearchQuery("")}>Limpiar búsqueda</button>}</div>}
              <div className="panel-heading"><span className="kicker">ASIGNACIONES</span><strong>{visibleRecords.length} certificaciones de técnicos</strong></div>
            </>}
            {visibleRecords.map((record) => <article className={`table-row selectable-row ${selectedCertificationId === record.certification_id ? "selected-row" : ""}`} key={record.id} role="button" tabIndex={0} aria-label={`Abrir detalle de ${certificationById.get(record.certification_id)?.name ?? "la certificación"}`} onClick={() => openCertification(record.certification_id)} onKeyDown={(event) => activateRow(event, () => openCertification(record.certification_id))}>
              <div className="brand-logo"><Award size={18}/></div><div><strong>{technicianNameById.get(record.technician_id) ?? "Técnico sin identificar"}</strong><span>{certificationById.get(record.certification_id)?.name ?? record.certification_id}</span>{!record.evidence_path && <span className="missing-pdf" title="Sin PDF adjunto"><FileWarning size={13} aria-hidden="true" />Sin PDF</span>}</div><span className={`status ${getRecordPresentation(record).className}`}>{getRecordPresentation(record).label}</span><span>Vence: {formatDate(record.expires_at)}</span>{canManage ? <div className="row-actions"><button onClick={(event) => { event.stopPropagation(); editTechnicianCertification(record); }}>Editar</button><button onClick={(event) => { event.stopPropagation(); deleteTechnicianCertification(record); }}>Eliminar</button></div> : <span />}
            </article>)}
            {visibleRecords.length === 0 && <div className="empty-state"><strong>No hay certificaciones que coincidan con los filtros actuales.</strong><p>{showMissingEvidenceOnly ? "No hay certificados vigentes pendientes de PDF o enlace." : showExpiringOnly ? "No hay certificados que venzan en los próximos 90 días." : searchQuery ? "Prueba con otra búsqueda o limpia el filtro actual." : "Registra una certificación completada para verla aquí."}</p>{(showExpiringOnly || showMissingEvidenceOnly || searchQuery) && <button type="button" className="text-button" onClick={() => { setShowExpiringOnly(false); setShowMissingEvidenceOnly(false); setSearchQuery(""); }}>Limpiar filtros</button>}</div>}
          </div>
        </section>}

        {activeSection === "requirements" && canManage && <section className="management-panel contextual-management">
          <div><span className="kicker">ADMINISTRACIÓN DE REQUISITOS</span><h2>Agregar un requisito</h2><p>Define cuántos técnicos certificados requiere cada marca para cumplir.</p></div>
          <div className="management-actions"><details><summary>Nuevo requisito</summary><form onSubmit={handleAddRequirement} className="inline-form"><select name="brand_id" required><option value="">Marca</option>{brands.filter((brand) => brand.status === "active").map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select><input name="certification_name" placeholder="Nombre de certificación" required /><input name="required_count" type="number" min="1" defaultValue="1" title="Cantidad requerida" required /><input name="effective_from" placeholder="Vigente desde MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} /><input name="effective_until" placeholder="Vigente hasta MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} /><label className="inline-checkbox"><input name="distinct_people_required" type="checkbox" defaultChecked /> Técnicos distintos</label><label className="inline-checkbox"><input name="mandatory" type="checkbox" defaultChecked /> Obligatorio</label><input name="notes" placeholder="Notas u observaciones (opcional)" /><button>Guardar requisito</button></form></details></div>
        </section>}

        {activeSection === "requirements" && <section className="panel data-panel">
          <div className="panel-heading"><div><span className="kicker">COBERTURA</span><h2>Requisitos</h2></div><div className="panel-meta"><span className="result-count">{visibleRequirements.length} resultados</span>{searchFilterLabel && <span className="filter-chip">{searchFilterLabel}</span>}{(searchQuery || selectedRequirementBrandId) && <button className="text-button" onClick={clearRequirementFilters}>Limpiar filtros</button>}</div></div>
          <div className="brand-filter-bar" aria-label="Filtrar requisitos por marca">
            <span className="brand-filter-label">Filtrar por marca</span>
            <button type="button" className={`brand-filter-tag ${selectedRequirementBrandId === null ? "active" : ""}`} aria-pressed={selectedRequirementBrandId === null} onClick={() => setSelectedRequirementBrandId(null)}>Todas <span>{requirements.length}</span></button>
            {requirementBrands.map((brand) => <button type="button" key={brand.id} className={`brand-filter-tag ${selectedRequirementBrandId === brand.id ? "active" : ""}`} aria-pressed={selectedRequirementBrandId === brand.id} onClick={() => setSelectedRequirementBrandId((current) => current === brand.id ? null : brand.id)}>{brand.name} <span>{requirementBrandCounts.get(brand.id)}</span></button>)}
          </div>
          <div className="table-list">
            {visibleRequirements.map((requirement) => <article className={`table-row requirement-row selectable-row ${selectedRequirementId === requirement.id ? "selected-row" : ""}`} key={requirement.id} role="button" tabIndex={0} aria-label={`Abrir requisito ${certificationById.get(requirement.certification_id)?.name ?? "sin identificar"}`} onClick={() => openRequirement(requirement.id)} onKeyDown={(event) => activateRow(event, () => openRequirement(requirement.id))}>
              <div className="brand-logo"><FileCheck2 size={18}/></div><div><strong>{brandNameById.get(requirement.brand_id) ?? "Marca sin identificar"}</strong><span>{certificationById.get(requirement.certification_id)?.name ?? requirement.certification_id}</span></div><div className="coverage-cell"><span>Cobertura</span><strong>{getRequirementCoverage(requirement).achieved} de {getRequirementCoverage(requirement).required} cubiertos</strong></div><div className="coverage-cell"><span>{getRequirementCoverage(requirement).gap === 0 ? "Estado" : "Pendiente"}</span><strong>{getRequirementCoverage(requirement).gap === 0 ? "Requisito cubierto" : `${getRequirementCoverage(requirement).gap} cupos`}</strong></div>{canManage ? <div className="row-actions"><button onClick={(event) => { event.stopPropagation(); editFullRequirement(requirement); }}>Editar</button><button onClick={(event) => { event.stopPropagation(); deleteRequirement(requirement); }}>Eliminar</button></div> : <span />}
            </article>)}
            {visibleRequirements.length === 0 && <div className="empty-state"><strong>No encontramos requisitos con esos criterios.</strong><p>{searchQuery || selectedRequirementBrandId ? "Limpia los filtros para volver a ver todos los requisitos." : "Agrega un requisito para empezar a medir la cobertura."}</p>{(searchQuery || selectedRequirementBrandId) && <button type="button" className="text-button" onClick={clearRequirementFilters}>Limpiar filtros</button>}</div>}
          </div>
        </section>}
      </section>

      {activeSection === "technicians" && selectedTechnician && <div className="modal-backdrop record-detail-backdrop" role="presentation" onMouseDown={() => setSelectedTechnicianId(null)}>
        <section className="entity-modal record-detail-modal" role="dialog" aria-modal="true" aria-labelledby="technician-modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-heading"><div><span className="kicker">TÉCNICO</span><h2 id="technician-modal-title">{selectedTechnician.full_name}</h2><p>{selectedTechnician.job_title ?? "Perfil de técnico"} · {selectedTechnician.area ?? "Sin área asignada"}</p></div><button type="button" className="modal-close" autoFocus onClick={() => setSelectedTechnicianId(null)}>Cerrar</button></div>
          <div className="detail-grid modal-summary"><div><span>Estado</span><strong>{getEntityStatusPresentation(selectedTechnician.status).label}</strong></div><div><span>Correo</span><strong>{selectedTechnician.email ?? "Sin correo"}</strong></div><div><span>Responsable</span><strong>{selectedTechnician.manager_name ?? "Sin asignar"}</strong></div><div><span>Certificaciones vigentes</span><strong>{records.filter((record) => record.technician_id === selectedTechnician.id && isRecordCurrent(record)).length} de {records.filter((record) => record.technician_id === selectedTechnician.id).length} registradas</strong></div><div><span>Fecha de ingreso</span><strong>{formatDate(selectedTechnician.start_date)}</strong></div><div><span>Observaciones</span><strong>{selectedTechnician.notes ?? "Sin observaciones"}</strong></div></div>
          {canManage && <div className="modal-section modal-actions"><button type="button" className="primary-action" onClick={() => { setSelectedTechnicianId(null); editTechnician(selectedTechnician); }}>Editar técnico</button></div>}
        </section>
      </div>}

      {activeSection === "certifications" && selectedCertification && <div className="modal-backdrop record-detail-backdrop" role="presentation" onMouseDown={() => setSelectedCertificationId(null)}>
        <section className="entity-modal record-detail-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-certification-modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-heading"><div><span className="kicker">CERTIFICACIÓN</span><h2 id="catalog-certification-modal-title">{selectedCertification.name}</h2><p>{brandNameById.get(selectedCertification.brand_id) ?? "Marca sin identificar"} · {selectedCertification.code ?? "Sin código"}</p></div><button type="button" className="modal-close" autoFocus onClick={() => setSelectedCertificationId(null)}>Cerrar</button></div>
          <div className="detail-grid modal-summary"><div><span>Tipo</span><strong>{selectedCertification.certification_type}</strong></div><div><span>Estado</span><strong>{getEntityStatusPresentation(selectedCertification.status, true).label}</strong></div><div><span>Vigencia</span><strong>{selectedCertification.validity_months ? `${selectedCertification.validity_months} meses` : "No definida"}</strong></div><div><span>Cobertura</span><strong>{selectedCertificationRequirement ? `${getRequirementCoverage(selectedCertificationRequirement).achieved} de ${getRequirementCoverage(selectedCertificationRequirement).required} cupos` : "Sin requisito asociado"}</strong></div><div><span>Certificaciones vigentes</span><strong>{records.filter((record) => record.certification_id === selectedCertification.id && isRecordCurrent(record)).length}</strong></div><div><span>Enlace oficial</span>{getSafeExternalUrl(selectedCertification.official_url) ? <a className="external-link" href={getSafeExternalUrl(selectedCertification.official_url)!} target="_blank" rel="noreferrer">Abrir sitio oficial</a> : <strong>{selectedCertification.official_url ? "Enlace no válido" : "No registrado"}</strong>}</div><div><span>Observaciones</span><strong>{selectedCertification.notes ?? "Sin observaciones"}</strong></div></div>
          {canManage && <div className="modal-section modal-actions"><button type="button" className="primary-action" onClick={() => { setSelectedCertificationId(null); editCatalogCertification(selectedCertification); }}>Editar certificación</button></div>}
        </section>
      </div>}

      {selectedRequirement && <div className="modal-backdrop record-detail-backdrop" role="presentation" onMouseDown={() => setSelectedRequirementId(null)}>
        <section className="entity-modal record-detail-modal" role="dialog" aria-modal="true" aria-labelledby="requirement-modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-heading"><div><span className="kicker">REQUISITO</span><h2 id="requirement-modal-title">{certificationById.get(selectedRequirement.certification_id)?.name ?? "Certificación sin identificar"}</h2><p>{brandNameById.get(selectedRequirement.brand_id) ?? "Marca sin identificar"}</p></div><button type="button" className="modal-close" autoFocus onClick={() => setSelectedRequirementId(null)}>Cerrar</button></div>
          <div className="detail-grid modal-summary"><div><span>Cobertura</span><strong>{getRequirementCoverage(selectedRequirement).achieved} de {getRequirementCoverage(selectedRequirement).required} cupos cubiertos</strong></div><div><span>Brecha pendiente</span><strong>{getRequirementCoverage(selectedRequirement).gap === 0 ? "Requisito cubierto" : `${getRequirementCoverage(selectedRequirement).gap} cupos pendientes`}</strong></div><div><span>Obligatorio</span><strong>{selectedRequirement.mandatory ? "Sí" : "No"}</strong></div><div><span>Criterio de conteo</span><strong>{selectedRequirement.distinct_people_required ? "Técnicos distintos" : "Certificaciones vigentes"}</strong></div><div><span>Vigencia</span><strong>{formatDate(selectedRequirement.effective_from)} - {formatDate(selectedRequirement.effective_until)}</strong></div><div><span>Observaciones</span><strong>{selectedRequirement.notes ?? "Sin observaciones"}</strong></div></div>
          <div className="modal-section"><div><span className="kicker">PERSONAS ASIGNADAS</span><h3>Técnicos que cubren este requisito</h3></div>{records.filter((record) => record.certification_id === selectedRequirement.certification_id && isRecordCurrent(record)).length > 0 ? <div className="requirement-people">{records.filter((record) => record.certification_id === selectedRequirement.certification_id && isRecordCurrent(record)).map((record) => <div key={record.id}><div><strong>{technicianNameById.get(record.technician_id) ?? "Técnico sin identificar"}</strong><span>Emitida: {formatDate(record.issued_at)} · Vence: {formatDate(record.expires_at)}</span>{record.notes && <span>{record.notes}</span>}</div><div className="assignment-actions"><span className={`status ${getRecordPresentation(record).className}`}>{getRecordPresentation(record).label}</span>{!record.evidence_path && <span className="missing-pdf" title="Sin PDF adjunto"><FileWarning size={14} aria-hidden="true"/>Sin PDF</span>}{canManage && <button type="button" className="text-button" onClick={() => editTechnicianCertification(record)}>Editar</button>}</div></div>)}</div> : <p className="modal-empty">Todavía no hay técnicos con una certificación vigente para este requisito.</p>}</div>
          {canManage && <div className="modal-section modal-actions"><button type="button" className="primary-action" onClick={() => { setSelectedRequirementId(null); editFullRequirement(selectedRequirement); }}>Editar requisito</button></div>}
        </section>
      </div>}

      {selectedBrand && selectedBrandSummary && <div className="modal-backdrop" role="presentation" onMouseDown={closeBrand}>
        <section className="entity-modal" role="dialog" aria-modal="true" aria-labelledby="brand-modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-heading"><div><span className="kicker">MARCA</span><h2 id="brand-modal-title">{selectedBrand.name}</h2><p>{selectedBrand.internal_owner ?? "Sin responsable asignado"}</p></div><button type="button" className="modal-close" autoFocus onClick={closeBrand}>Cerrar</button></div>
          <div className="detail-grid modal-summary"><div><span>Estado</span><strong>{getEntityStatusPresentation(selectedBrand.status, true).label}</strong></div><div><span>Cobertura</span><strong>{selectedBrandSummary.covered} de {selectedBrandSummary.required} cupos</strong></div><div><span>Cumplimiento</span><strong>{selectedBrandSummary.compliance}%</strong></div><div><span>Certificaciones</span><strong>{certifications.filter((certification) => certification.brand_id === selectedBrand.id).length}</strong></div><div><span>Requisitos</span><strong>{requirements.filter((requirement) => requirement.brand_id === selectedBrand.id).length}</strong></div><div><span>Notas</span><strong>{selectedBrand.notes ?? "Sin notas"}</strong></div></div>

          <div className="modal-section"><div><span className="kicker">REQUISITOS DE {selectedBrand.name.toUpperCase()}</span><h3>Requisitos de certificación</h3></div>
            {requirements.filter((requirement) => requirement.brand_id === selectedBrand.id).length > 0 ? <div className="brand-requirements">{requirements.filter((requirement) => requirement.brand_id === selectedBrand.id).map((requirement) => <button type="button" key={requirement.id} onClick={() => openRequirement(requirement.id)}><strong>{certificationById.get(requirement.certification_id)?.name ?? "Certificación sin identificar"}</strong><span>{getRequirementCoverage(requirement).achieved} de {getRequirementCoverage(requirement).required} cubiertos · {getRequirementCoverage(requirement).compliance}%</span></button>)}</div> : <p className="modal-empty">Aún no hay requisitos registrados para esta marca.</p>}
          </div>

          {canManage && <div className="modal-section modal-form-section"><details><summary>Agregar requisito a {selectedBrand.name}</summary><form onSubmit={handleAddRequirement} className="inline-form"><input type="hidden" name="brand_id" value={selectedBrand.id} /><input name="certification_name" placeholder="Nombre de certificación" required /><input name="required_count" type="number" min="1" defaultValue="1" title="Cantidad requerida" required /><input name="effective_from" placeholder="Vigente desde MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} /><input name="effective_until" placeholder="Vigente hasta MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} /><label className="inline-checkbox"><input name="distinct_people_required" type="checkbox" defaultChecked /> Técnicos distintos</label><label className="inline-checkbox"><input name="mandatory" type="checkbox" defaultChecked /> Obligatorio</label><input name="notes" placeholder="Notas u observaciones (opcional)" /><button>Guardar requisito</button></form></details></div>}
        </section>
      </div>}

      {activeSection === "brands" && selectedBrand && selectedCertification && selectedCertification.brand_id === selectedBrand.id && <div className="modal-backdrop certificate-modal-backdrop" role="presentation" onMouseDown={() => setSelectedCertificationId(null)}>
        <section className="entity-modal certificate-modal" role="dialog" aria-modal="true" aria-labelledby="certification-modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-heading"><div><span className="kicker">CERTIFICACIÓN · {selectedBrand.name.toUpperCase()}</span><h2 id="certification-modal-title">{selectedCertification.name}</h2><p>{selectedCertification.code ?? "Sin código"} · {selectedCertification.certification_type}</p></div><button type="button" className="modal-close" autoFocus onClick={() => setSelectedCertificationId(null)}>Volver a {selectedBrand.name}</button></div>
          <div className="detail-grid modal-summary"><div><span>Cobertura</span><strong>{selectedCertificationRequirement ? `${getRequirementCoverage(selectedCertificationRequirement).achieved} de ${getRequirementCoverage(selectedCertificationRequirement).required} cupos cubiertos` : "Sin requisito asociado"}</strong></div><div><span>Brecha pendiente</span><strong>{selectedCertificationRequirement ? getRequirementCoverage(selectedCertificationRequirement).gap === 0 ? "Requisito cubierto" : `${getRequirementCoverage(selectedCertificationRequirement).gap} cupos pendientes` : "No aplica"}</strong></div><div><span>Vigencia</span><strong>{selectedCertification.validity_months ? `${selectedCertification.validity_months} meses` : "No definida"}</strong></div></div>

          <div className="modal-section"><div><span className="kicker">EJECUCIÓN</span><h3>Certificaciones realizadas</h3></div>
            {records.filter((record) => record.certification_id === selectedCertification.id).length > 0 ? <div className="certificate-assignments">{records.filter((record) => record.certification_id === selectedCertification.id).map((record) => <div key={record.id}><div><strong>{technicianNameById.get(record.technician_id) ?? "Técnico sin identificar"}</strong><span>Emitida: {formatDate(record.issued_at)} · Vence: {formatDate(record.expires_at)}</span>{record.certificate_number && <span>N.º {record.certificate_number}</span>}{record.notes && <span className="assignment-note">{record.notes}</span>}</div><div className="assignment-actions"><span className={`status ${getRecordPresentation(record).className}`}>{getRecordPresentation(record).label}</span>{!record.evidence_path && <span className="missing-pdf" title="Sin PDF adjunto"><FileWarning size={14} aria-hidden="true" />Sin PDF adjunto</span>}{(record.evidence_path || record.verification_url) && <button type="button" className="text-button" onClick={() => openCertificateEvidence(record)}>Ver respaldo</button>}{canManage && <button type="button" className="text-button" onClick={() => editTechnicianCertification(record)}>Editar</button>}</div></div>)}</div> : <p className="modal-empty">Todavía no hay técnicos registrados con esta certificación.</p>}
          </div>

          {canManage && <div className="modal-section modal-form-section"><details><summary>Registrar certificación completada</summary><form onSubmit={handleAddTechnicianCertification} className="inline-form"><input type="hidden" name="certification_id" value={selectedCertification.id} /><select name="technician_id" required><option value="">Técnico certificado</option>{technicians.filter((technician) => technician.status === "active").map((technician) => <option key={technician.id} value={technician.id}>{technician.full_name}</option>)}</select><input name="issued_at" placeholder="Emisión MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} required /><input name="expires_at" placeholder="Vencimiento MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} /><input name="certificate_number" placeholder="N.º de certificado" /><select name="status" defaultValue="active"><option value="active">Vigente</option><option value="expiring">Por vencer</option><option value="pending_validation">Pendiente de validar</option></select><input name="notes" placeholder="Observación o información extra" /><input name="certificate_file" type="file" accept="application/pdf" title="PDF del certificado" /><input name="verification_url" type="url" placeholder="Enlace de evidencia (opcional)" /><button>Registrar completada</button></form></details></div>}
        </section>
      </div>}

      {editingBrand && <div className="modal-backdrop edit-modal-backdrop" role="presentation" onMouseDown={() => setEditingBrand(null)}><section className="entity-modal edit-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="kicker">EDITAR MARCA</span><h2>{editingBrand.name}</h2></div><button className="modal-close" onClick={() => setEditingBrand(null)}>Cancelar</button></div><form onSubmit={handleUpdateBrand} className="edit-form"><label>Nombre<input name="name" defaultValue={editingBrand.name} required /></label><label>Responsable interno<input name="internal_owner" defaultValue={editingBrand.internal_owner ?? ""} /></label><label>Estado<select name="status" defaultValue={editingBrand.status}><option value="active">Activa</option><option value="inactive">Inactiva</option><option value="review">En revisión</option></select></label><label className="form-wide">Notas<textarea name="notes" defaultValue={editingBrand.notes ?? ""} /></label><button>Guardar cambios</button></form></section></div>}

      {editingTechnician && <div className="modal-backdrop edit-modal-backdrop" role="presentation" onMouseDown={() => setEditingTechnician(null)}><section className="entity-modal edit-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="kicker">EDITAR TÉCNICO</span><h2>{editingTechnician.full_name}</h2></div><button className="modal-close" onClick={() => setEditingTechnician(null)}>Cancelar</button></div><form onSubmit={handleUpdateTechnician} className="edit-form"><label>Nombre completo<input name="full_name" defaultValue={editingTechnician.full_name} required /></label><label>Correo<input name="email" type="email" defaultValue={editingTechnician.email ?? ""} /></label><label>Cargo<input name="job_title" defaultValue={editingTechnician.job_title ?? ""} /></label><label>Área<input name="area" defaultValue={editingTechnician.area ?? ""} /></label><label>Fecha de ingreso<input name="start_date" placeholder="MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} defaultValue={formatDate(editingTechnician.start_date) === "Sin fecha" ? "" : formatDate(editingTechnician.start_date)} /></label><label>Responsable<input name="manager_name" defaultValue={editingTechnician.manager_name ?? ""} /></label><label>Estado<select name="status" defaultValue={editingTechnician.status}><option value="active">Activo</option><option value="inactive">Inactivo</option><option value="leave">Ausente</option></select></label><label className="form-wide">Notas<textarea name="notes" defaultValue={editingTechnician.notes ?? ""} /></label><button>Guardar cambios</button></form></section></div>}

      {editingCatalogCertification && <div className="modal-backdrop edit-modal-backdrop" role="presentation" onMouseDown={() => setEditingCatalogCertification(null)}><section className="entity-modal edit-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="kicker">EDITAR CERTIFICACIÓN</span><h2>{editingCatalogCertification.name}</h2></div><button className="modal-close" onClick={() => setEditingCatalogCertification(null)}>Cancelar</button></div><form onSubmit={handleUpdateCatalogCertification} className="edit-form"><label>Marca<select name="brand_id" defaultValue={editingCatalogCertification.brand_id}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><label>Nombre<input name="name" defaultValue={editingCatalogCertification.name} required /></label><label>Código<input name="code" defaultValue={editingCatalogCertification.code ?? ""} /></label><label>Tipo<select name="certification_type" defaultValue={editingCatalogCertification.certification_type}><option value="technical">Técnica</option><option value="sales">Ventas</option><option value="presales">Preventas</option><option value="implementation">Implementación</option><option value="support">Soporte</option><option value="architecture">Arquitectura</option><option value="other">Otra</option></select></label><label>Nivel<input name="level" defaultValue={editingCatalogCertification.level ?? ""} /></label><label>Vigencia (meses)<input name="validity_months" type="number" min="1" defaultValue={editingCatalogCertification.validity_months ?? ""} /></label><label>URL oficial<input name="official_url" type="url" defaultValue={editingCatalogCertification.official_url ?? ""} /></label><label>Estado<select name="status" defaultValue={editingCatalogCertification.status}><option value="active">Activa</option><option value="inactive">Inactiva</option><option value="retired">Retirada</option></select></label><label className="form-wide">Observaciones<textarea name="notes" defaultValue={editingCatalogCertification.notes ?? ""} /></label><button>Guardar cambios</button></form></section></div>}

      {editingRequirement && <div className="modal-backdrop edit-modal-backdrop" role="presentation" onMouseDown={() => setEditingRequirement(null)}><section className="entity-modal edit-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="kicker">EDITAR REQUISITO</span><h2>{brandNameById.get(editingRequirement.brand_id)}</h2></div><button className="modal-close" onClick={() => setEditingRequirement(null)}>Cancelar</button></div><form onSubmit={handleUpdateRequirement} className="edit-form"><label>Marca<select name="brand_id" defaultValue={editingRequirement.brand_id}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><label>Nombre de certificación<input name="certification_name" defaultValue={certificationById.get(editingRequirement.certification_id)?.name ?? ""} required /></label><label>Cantidad requerida<input name="required_count" type="number" min="1" defaultValue={editingRequirement.required_count} required /></label><label>Vigente desde<input name="effective_from" placeholder="MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} defaultValue={formatDate(editingRequirement.effective_from) === "Sin fecha" ? "" : formatDate(editingRequirement.effective_from)} /></label><label>Vigente hasta<input name="effective_until" placeholder="MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} defaultValue={formatDate(editingRequirement.effective_until) === "Sin fecha" ? "" : formatDate(editingRequirement.effective_until)} /></label><label className="checkbox-label"><input name="distinct_people_required" type="checkbox" defaultChecked={editingRequirement.distinct_people_required} /> Técnicos distintos</label><label className="checkbox-label"><input name="mandatory" type="checkbox" defaultChecked={editingRequirement.mandatory} /> Obligatorio</label><label className="form-wide">Notas<textarea name="notes" defaultValue={editingRequirement.notes ?? ""} /></label><button>Guardar cambios</button></form></section></div>}

      {editingCertificationRecord && <div className="modal-backdrop edit-modal-backdrop" role="presentation" onMouseDown={() => setEditingCertificationRecord(null)}><section className="entity-modal edit-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="kicker">EDITAR CERTIFICACIÓN REALIZADA</span><h2>{certificationById.get(editingCertificationRecord.certification_id)?.name ?? "Certificación"}</h2></div><button className="modal-close" onClick={() => setEditingCertificationRecord(null)}>Cancelar</button></div><form onSubmit={handleUpdateCertificationRecord} className="edit-form"><label>Técnico<select name="technician_id" defaultValue={editingCertificationRecord.technician_id}>{technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.full_name}</option>)}</select></label><label>Certificación<select name="certification_id" defaultValue={editingCertificationRecord.certification_id}>{certifications.map((certification) => <option key={certification.id} value={certification.id}>{brandNameById.get(certification.brand_id)} · {certification.name}</option>)}</select></label><label>Fecha de emisión<input name="issued_at" placeholder="MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} defaultValue={formatDate(editingCertificationRecord.issued_at) === "Sin fecha" ? "" : formatDate(editingCertificationRecord.issued_at)} /></label><label>Fecha de vencimiento<input name="expires_at" placeholder="MM/DD/AAAA" inputMode="numeric" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} defaultValue={formatDate(editingCertificationRecord.expires_at) === "Sin fecha" ? "" : formatDate(editingCertificationRecord.expires_at)} /></label><label>N.º de certificado<input name="certificate_number" defaultValue={editingCertificationRecord.certificate_number ?? ""} /></label><label>Estado<select name="status" defaultValue={editingCertificationRecord.status}><option value="active">Vigente</option><option value="expiring">Por vencer</option><option value="pending_validation">Pendiente de validar</option></select></label><label>Nuevo PDF (opcional)<input name="certificate_file" type="file" accept="application/pdf" /></label><label>Enlace de evidencia<input name="verification_url" type="url" defaultValue={editingCertificationRecord.verification_url ?? ""} /></label><label className="form-wide">Observación o información extra<textarea name="notes" defaultValue={editingCertificationRecord.notes ?? ""} /></label><button>Guardar cambios</button></form></section></div>}
    </main>
  );
}
