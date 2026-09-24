import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * CoreCert se migró a Core Operaciones el 2026-09-24 y queda sólo de lectura.
 * Los datos siguen aquí como respaldo, pero ya no se editan: todo se gestiona
 * en Core (/certificaciones).
 */
export const SOLO_LECTURA = true;
export const URL_CORE = "https://core-operaciones-dashboard.vercel.app/certificaciones";
const MENSAJE_SOLO_LECTURA = "CoreCert es sólo de lectura: las certificaciones ahora se gestionan en Core Operaciones.";

// Respuesta de escritura bloqueada con la misma forma que la de Supabase
// ({ data, error }); admite encadenar .select().single() y se puede esperar.
function escrituraBloqueada(): unknown {
  const resultado = { data: null, error: { message: MENSAJE_SOLO_LECTURA } };
  const cadena: unknown = new Proxy(function () {}, {
    get: (_objetivo, clave) => (clave === "then" ? (resolver: (valor: unknown) => unknown) => Promise.resolve(resultado).then(resolver) : () => cadena),
    apply: () => cadena,
  });
  return cadena;
}

const ESCRITURAS_TABLA = new Set(["insert", "update", "upsert", "delete"]);
const ESCRITURAS_ARCHIVO = new Set(["upload", "update", "remove", "move", "copy"]);

// Deja pasar lecturas (select, signed URLs, auth) y bloquea toda escritura,
// aunque algún botón quedara visible por error.
function soloLectura<T extends object>(objetivo: T, escrituras: Set<string>): T {
  return new Proxy(objetivo, {
    get(destino, clave, receptor) {
      if (typeof clave === "string" && escrituras.has(clave)) return () => escrituraBloqueada();
      const valor = Reflect.get(destino, clave, receptor);
      return typeof valor === "function" ? valor.bind(destino) : valor;
    },
  });
}

let supabaseClient: SupabaseClient<any> | undefined;

export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase environment variables");
  }

  if (!supabaseClient) {
    const cliente = createClient<any>(supabaseUrl, supabasePublishableKey);
    supabaseClient = SOLO_LECTURA
      ? new Proxy(cliente, {
          get(destino, clave, receptor) {
            if (clave === "from") return (tabla: string) => soloLectura(destino.from(tabla), ESCRITURAS_TABLA);
            if (clave === "storage") return new Proxy(destino.storage, {
              get(almacen, claveAlmacen, receptorAlmacen) {
                if (claveAlmacen === "from") return (balde: string) => soloLectura(almacen.from(balde), ESCRITURAS_ARCHIVO);
                const valor = Reflect.get(almacen, claveAlmacen, receptorAlmacen);
                return typeof valor === "function" ? valor.bind(almacen) : valor;
              },
            });
            const valor = Reflect.get(destino, clave, receptor);
            return typeof valor === "function" ? valor.bind(destino) : valor;
          },
        })
      : cliente;
  }

  return supabaseClient;
}
