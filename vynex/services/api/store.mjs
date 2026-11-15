import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export const now = () => new Date().toISOString();
export function openStore(directory = resolve('data')) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(resolve(directory, 'vynex.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, action TEXT NOT NULL, at TEXT NOT NULL);`);
  db.prepare('INSERT OR IGNORE INTO settings VALUES (1, ?)').run(JSON.stringify({ monthlyGoal: 500, monetized: false, automation: false, queuePaused: false, ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b', ttsVoice: process.env.TTS_VOICE || 'Microsoft Maria Desktop', ttsRate: 0 }));
  return {
    db,
    list(kind) { return db.prepare('SELECT body FROM records WHERE kind=? ORDER BY created_at DESC').all(kind).map(r => JSON.parse(r.body)); },
    get(id, kind) { const row = db.prepare('SELECT body FROM records WHERE id=? AND kind=?').get(id, kind); return row ? JSON.parse(row.body) : null; },
    remove(id, kind) { db.prepare('DELETE FROM records WHERE id=? AND kind=?').run(id, kind); },
    put(kind, body) {
      const item = { ...body, id: body.id || randomUUID(), createdAt: body.createdAt || now(), updatedAt: now() };
      db.prepare('INSERT INTO records VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET body=excluded.body WHERE records.kind=excluded.kind').run(item.id, kind, JSON.stringify(item), item.createdAt);
      return item;
    },
    settings() { return JSON.parse(db.prepare('SELECT body FROM settings WHERE id=1').get().body); },
    configure(update) {
      const settings = { ...this.settings(), ...update };
      db.prepare('UPDATE settings SET body=? WHERE id=1').run(JSON.stringify(settings));
      db.prepare('INSERT INTO audit VALUES (?, ?, ?)').run(randomUUID(), JSON.stringify({ actor: 'local-user', changes: update }), now());
      return settings;
    },
    audit() { return db.prepare('SELECT * FROM audit ORDER BY at DESC LIMIT 50').all(); }
  };
}

export function required(value, label, max = 10000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label}: valor obrigatório (máximo ${max} caracteres).`);
  return value.trim();
}
export function nonnegative(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${label}: informe um número não negativo.`);
  return value;
}
export function webUrl(value) {
  const url = new URL(required(value, 'URL', 2000));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use uma URL HTTP ou HTTPS.');
  return url.href;
}
export function financialSummary(metrics, settings, month = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date())) {
  const eligible = metrics.filter(m => m.date?.startsWith(month) && ['confirmed', 'pending'].includes(m.status) && (m.platform !== 'youtube' || settings.monetized));
  const confirmed = eligible.filter(m => m.status === 'confirmed').reduce((sum, m) => sum + m.amountCents, 0) / 100;
  const pending = eligible.filter(m => m.status === 'pending').reduce((sum, m) => sum + m.amountCents, 0) / 100;
  return { month, confirmed, pending, remaining: Math.max(0, settings.monthlyGoal - confirmed), percent: settings.monthlyGoal > 0 ? Math.min(100, confirmed / settings.monthlyGoal * 100) : 0, hasData: eligible.length > 0 };
}
