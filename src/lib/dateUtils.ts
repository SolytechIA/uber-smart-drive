/**
 * Utilitários de data centralizados — TODOS respeitam America/Sao_Paulo (UTC-3/-2 com DST).
 *
 * Use estas funções em qualquer lugar que precise comparar / filtrar datas
 * por "hoje", "esta semana", "este mês". Nunca use new Date().toISOString().slice(0,10)
 * diretamente para representar "o dia de hoje" do motorista.
 */

import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  format,
  isSameDay,
} from "date-fns";
import { nowInTZ, TZ } from "./financeiro";

/** "YYYY-MM-DD" do dia atual em America/Sao_Paulo. */
export function getTodaySP(): string {
  return format(nowInTZ(), "yyyy-MM-dd");
}

/** "YYYY-MM-DD" de ontem em America/Sao_Paulo. */
export function getYesterdaySP(): string {
  const d = nowInTZ();
  d.setDate(d.getDate() - 1);
  return format(d, "yyyy-MM-dd");
}

/** Início do dia atual (00:00) em SP, retornado como Date wallclock. */
export function getStartOfTodaySP(): Date {
  return startOfDay(nowInTZ());
}

/** Fim do dia atual (23:59:59) em SP. */
export function getEndOfTodaySP(): Date {
  return endOfDay(nowInTZ());
}

/** Início da semana atual (segunda-feira 00:00) em SP. */
export function getStartOfWeekSP(): Date {
  return startOfWeek(nowInTZ(), { weekStartsOn: 1 });
}

/** Fim da semana atual (domingo 23:59:59) em SP. */
export function getEndOfWeekSP(): Date {
  return endOfWeek(nowInTZ(), { weekStartsOn: 1 });
}

/** Início do mês atual em SP. */
export function getStartOfMonthSP(): Date {
  return startOfMonth(nowInTZ());
}

/** Fim do mês atual em SP. */
export function getEndOfMonthSP(): Date {
  return endOfMonth(nowInTZ());
}

/** Aceita "YYYY-MM-DD" (data civil) ou ISO instant — converte para Date wallclock em SP. */
function toSPDate(value: string | Date): Date {
  if (value instanceof Date) {
    // converte instant para wallclock SP
    return new Date(value.toLocaleString("en-US", { timeZone: TZ }));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // data civil — meio-dia para evitar bordas
    return new Date(`${value}T12:00:00`);
  }
  return new Date(new Date(value).toLocaleString("en-US", { timeZone: TZ }));
}

export function isToday(value: string | Date): boolean {
  return isSameDay(toSPDate(value), nowInTZ());
}

export function isYesterday(value: string | Date): boolean {
  const y = nowInTZ();
  y.setDate(y.getDate() - 1);
  return isSameDay(toSPDate(value), y);
}

export function isSameWeekSP(value: string | Date): boolean {
  const d = toSPDate(value);
  const ini = getStartOfWeekSP();
  const fim = getEndOfWeekSP();
  return d >= ini && d <= fim;
}

export function isSameMonthSP(value: string | Date): boolean {
  const d = toSPDate(value);
  const now = nowInTZ();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/** Formata um título de data extenso ("Terça-feira, 28 de abril") em SP. */
export function formatLongDateSP(): string {
  const d = nowInTZ();
  const f = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  });
  return f.charAt(0).toUpperCase() + f.slice(1);
}
