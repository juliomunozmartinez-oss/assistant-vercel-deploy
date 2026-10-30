import type Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";
import { config } from "./config.js";
import type { Caso } from "./scoring.js";

export type Historial = Anthropic.Beta.BetaMessageParam[];

export interface Store {
  /** true si el id de mensaje no se había visto (Meta reintenta los webhooks). */
  marcarMensajeNuevo(id: string): Promise<boolean>;
  encolar(telefono: string, texto: string): Promise<void>;
  sacarCola(telefono: string): Promise<string[]>;
  tamanoCola(telefono: string): Promise<number>;
  tomarCandado(telefono: string): Promise<boolean>;
  soltarCandado(telefono: string): Promise<void>;
  leerHistorial(telefono: string): Promise<Historial>;
  guardarHistorial(telefono: string, h: Historial): Promise<void>;
  leerCaso(telefono: string): Promise<Caso | null>;
  guardarCaso(caso: Caso, puntaje: number): Promise<void>;
}

const ttl = () => config.diasRetencion * 24 * 3600;

export class RedisStore implements Store {
  // Lee UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (o las KV_* de la integración de Vercel).
  private r = Redis.fromEnv();

  async marcarMensajeNuevo(id: string) {
    return (await this.r.set(`wa:msg:${id}`, 1, { nx: true, ex: 86400 })) === "OK";
  }
  async encolar(tel: string, texto: string) {
    await this.r.rpush(`wa:cola:${tel}`, texto);
    await this.r.expire(`wa:cola:${tel}`, 3600);
  }
  async sacarCola(tel: string) {
    const [items] = await this.r.multi().lrange<string>(`wa:cola:${tel}`, 0, -1).del(`wa:cola:${tel}`).exec<[string[], number]>();
    // Upstash deserializa JSON automáticamente: un mensaje "123" llegaría como número.
    return (items ?? []).map(String);
  }
  async tamanoCola(tel: string) {
    return await this.r.llen(`wa:cola:${tel}`);
  }
  async tomarCandado(tel: string) {
    return (await this.r.set(`wa:lock:${tel}`, 1, { nx: true, ex: 90 })) === "OK";
  }
  async soltarCandado(tel: string) {
    await this.r.del(`wa:lock:${tel}`);
  }
  async leerHistorial(tel: string) {
    return (await this.r.get<Historial>(`wa:hist:${tel}`)) ?? [];
  }
  async guardarHistorial(tel: string, h: Historial) {
    await this.r.set(`wa:hist:${tel}`, h, { ex: ttl() });
  }
  async leerCaso(tel: string) {
    return await this.r.get<Caso>(`caso:${tel}`);
  }
  async guardarCaso(caso: Caso, puntaje: number) {
    // Los casos no expiran: son el registro del despacho. El índice ordena por puntaje para revisión.
    await this.r.set(`caso:${caso.telefono}`, caso);
    await this.r.zadd("casos:por_puntaje", { score: puntaje, member: caso.telefono });
  }
}

/** Para pruebas locales (scripts/chat-local.ts y tests). */
export class MemoriaStore implements Store {
  vistos = new Set<string>();
  colas = new Map<string, string[]>();
  candados = new Set<string>();
  historiales = new Map<string, Historial>();
  casos = new Map<string, Caso>();

  async marcarMensajeNuevo(id: string) {
    if (this.vistos.has(id)) return false;
    this.vistos.add(id);
    return true;
  }
  async encolar(tel: string, texto: string) {
    this.colas.set(tel, [...(this.colas.get(tel) ?? []), texto]);
  }
  async sacarCola(tel: string) {
    const items = this.colas.get(tel) ?? [];
    this.colas.delete(tel);
    return items;
  }
  async tamanoCola(tel: string) {
    return this.colas.get(tel)?.length ?? 0;
  }
  async tomarCandado(tel: string) {
    if (this.candados.has(tel)) return false;
    this.candados.add(tel);
    return true;
  }
  async soltarCandado(tel: string) {
    this.candados.delete(tel);
  }
  async leerHistorial(tel: string) {
    return structuredClone(this.historiales.get(tel) ?? []);
  }
  async guardarHistorial(tel: string, h: Historial) {
    this.historiales.set(tel, structuredClone(h));
  }
  async leerCaso(tel: string) {
    return this.casos.get(tel) ?? null;
  }
  async guardarCaso(caso: Caso) {
    this.casos.set(caso.telefono, structuredClone(caso));
  }
}
