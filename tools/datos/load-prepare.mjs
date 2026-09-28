import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const environment = Object.fromEntries((await fs.readFile('.env.local', 'utf8')).split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, '')]; }));
const url = environment.NEXT_PUBLIC_SUPABASE_URL;
const key = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = environment.SUPABASE_SECRET_KEY ?? environment.SUPABASE_SERVICE_ROLE_KEY;
if (url !== 'https://bnqyyumfmyexsqszglab.supabase.co' || !key || !secret) throw new Error('Proyecto de carga no autorizado.');
const client = k => createClient(url, k, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const admin = client(secret), accountsPath = '.local-private/load-accounts.json', fixturesPath = '.local-private/load-fixtures.json';
const sessionsPath = '.local-private/load-sessions.json';
let sessions = {};
try { sessions = JSON.parse(await fs.readFile(sessionsPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
let accounts, fixtures;
try { accounts = JSON.parse(await fs.readFile(accountsPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; accounts = { projectRef: 'bnqyyumfmyexsqszglab', createdAt: new Date().toISOString(), users: [] }; }
try { fixtures = JSON.parse(await fs.readFile(fixturesPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; fixtures = { projectRef: accounts.projectRef, createdAt: new Date().toISOString(), groups: [] }; }
if (accounts.projectRef !== 'bnqyyumfmyexsqszglab' || fixtures.projectRef !== accounts.projectRef) throw new Error('Archivos privados de otro proyecto.');
await fs.mkdir('.local-private', { recursive: true });
const storeAccounts = () => fs.writeFile(accountsPath, JSON.stringify(accounts, null, 2) + '\n');
const storeFixtures = () => fs.writeFile(fixturesPath, JSON.stringify(fixtures, null, 2) + '\n');
const id = () => crypto.randomUUID();
async function command(c, action, ...args) { const r = await c.rpc('aulify_command', { p_action: action, p_payload: { args } }); if (r.error || r.data?.error) throw new Error(`Preparación ${action} rechazada: ${(r.error || r.data.error).code}`); return r.data; }
let lastLogin = 0;
async function signIn(account) {
  const pause = Math.max(0, 2500 - (Date.now() - lastLogin));
  if (pause) await new Promise(resolve => setTimeout(resolve, pause));
  const c = client(key);
  for (let retry = 0; retry < 10; retry++) {
    lastLogin = Date.now();
    const r = await c.auth.signInWithPassword({ email: account.email, password: account.password });
    if (!r.error) {
      sessions[account.id] = r.data.session;
      await fs.writeFile(sessionsPath, JSON.stringify(sessions) + '\n');
      return c;
    }
    if (r.error.status !== 429) throw new Error(`No se pudo autenticar cuenta ficticia: ${r.error.code}`);
    console.log('Auth solicita reducir la frecuencia. Esperando 60 segundos antes del reintento.');
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
  throw new Error('Auth mantiene el límite de frecuencia; preparación conservada para continuar después.');
}
try {
  for (let group = 0; group < 4; group++) {
    for (let position = 0; position <= 50; position++) {
      if (accounts.users.some(a => a.group === group && a.position === position)) continue;
      const role = position === 0 ? 'teacher' : 'student';
      const email = `carga-${group}-${position}-${id().slice(0, 8)}@example.test`;
      const password = crypto.randomBytes(24).toString('base64url') + 'aA9!';
      const name = position === 0 ? `Docente ficticio ${group + 1}` : `Estudiante ficticio ${group + 1}-${String(position).padStart(2, '0')}`;
      const r = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, role } });
      if (r.error) throw new Error(`No se pudo crear cuenta ficticia: ${r.error.code}`);
      accounts.users.push({ id: r.data.user.id, group, position, role, email, password, name });
      await storeAccounts();
      if (accounts.users.length % 25 === 0) console.log(`Cuentas ficticias preparadas: ${accounts.users.length}/204`);
    }
  }
  console.log(`Cuentas ficticias preparadas: ${accounts.users.length}/204. Sin envío de correos.`);
  for (let group = 0; group < 4; group++) {
    const teacher = accounts.users.find(a => a.group === group && a.role === 'teacher');
    const c = await signIn(teacher);
    let fixture = fixtures.groups.find(g => g.group === group);
    if (!fixture) {
      const subject = await command(c, 'createSubject', { name: `Biología · carga ${group + 1}`, course: '3.º', year: 2026, description: 'Datos sintéticos de verificación de capacidad.' });
      fixture = { group, subjectId: subject.id, teacherId: teacher.id, students: [] }; fixtures.groups.push(fixture); await storeFixtures();
    }
    const snap = await c.rpc('aulify_snapshot'); if (snap.error) throw new Error('No se pudo consultar el escenario.');
    const code = snap.data.state.subjects.find(s => s.id === fixture.subjectId).code;
    for (const student of accounts.users.filter(a => a.group === group && a.role === 'student')) {
      if (fixture.students.includes(student.id)) continue;
      const sc = await signIn(student);
      const request = await command(sc, 'requestMembership', code);
      await command(c, 'decideMembership', request.id, 'approved');
      fixture.students.push(student.id); await storeFixtures();
    }
    if (!fixture.versionId) {
      const questions = Array.from({ length: 10 }, (_, n) => { const correct = id(), wrong = id(); return { id: id(), type: 'single', prompt: `Pregunta de práctica ${n + 1}: ¿qué recurso utiliza una planta?`, points: 1, options: [{ id: correct, text: 'Luz' }, { id: wrong, text: 'Plástico' }], correctOptionId: correct, explanation: 'La luz aporta energía para la fotosíntesis.' }; });
      const resource = { id: id(), title: 'Diez preguntas de práctica', kind: 'quiz', blocks: [{ id: id(), type: 'quiz', questions }], revision: 1 };
      await command(c, 'saveDraft', resource, 0);
      const version = await command(c, 'publishResource', resource.id);
      fixture.resourceId = resource.id; fixture.versionId = version.id; fixture.questions = questions;
      await storeFixtures();
    }
    console.log(`Materia ${group + 1}/4: 50 integrantes y recurso de 10 preguntas preparados.`);
  }
  fixtures.preparedAt = new Date().toISOString(); await storeFixtures();
  console.log('Preparación completa. La carga NO se ha iniciado; los archivos privados conservan las cuentas y escenarios.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
