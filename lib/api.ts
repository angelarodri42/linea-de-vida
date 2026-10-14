import "server-only";
import { NextResponse } from "next/server";
import { UserError } from "./db";

/** Wrap a route handler body: maps UserError to 4xx JSON, anything else to 500. */
export async function handle<T>(fn: () => T | Promise<T>) {
  try {
    return NextResponse.json(await fn());
  } catch (err) {
    if (err instanceof UserError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Algo salió mal." }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {}
  throw new UserError("Cuerpo JSON no válido.");
}

export function toInt(v: unknown, name: string): number {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n)) {
    throw new UserError(`"${name}" debe ser un número entero.`);
  }
  return n;
}
