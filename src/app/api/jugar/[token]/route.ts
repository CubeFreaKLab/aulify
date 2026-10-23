import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { guestError, guestProjection, guestStore, guestToken } from '@/lib/guest-practice';
import { isSameOrigin, jsonResponse, readJson } from '@/lib/http';
import { AVATARS } from '@/domain/avatars';
import { numeric, scoreQuestion } from '@/domain/rules';
import type { AnswerValue } from '@/domain/types';

type Context = { params: Promise<{ token: string }> };
const cookieName = (token: string) => `aulify-guest-${token}`;
const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');
const secretOf = (request: NextRequest, token: string) => {
  const value = request.cookies.get(cookieName(token))?.value;
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
};
export async function GET(request: NextRequest, context: Context) {
  const { token } = await context.params;
  if (!guestToken.test(token)) return jsonResponse({ error: 'Enlace no disponible.' }, 404);
  try {
    const secret = secretOf(request, token);
    return jsonResponse(
      guestProjection(
        await guestStore('read', { token, secretHash: secret ? hash(secret) : null }),
      ),
    );
  } catch (error) {
    const failure = guestError(error);
    return jsonResponse({ error: failure.message }, failure.status);
  }
}
export async function POST(request: NextRequest, context: Context) {
  if (!isSameOrigin(request)) return jsonResponse({ error: 'Origen no permitido.' }, 403);
  const { token } = await context.params;
  if (!guestToken.test(token)) return jsonResponse({ error: 'Enlace no disponible.' }, 404);
  let body: Record<string, unknown>;
  try {
    body = await readJson(request, 12000);
  } catch {
    return jsonResponse({ error: 'Solicitud inválida.' }, 400);
  }
  try {
    if (body.action === 'join') {
      if (
        typeof body.name !== 'string' ||
        body.name.trim().length < 2 ||
        body.name.trim().length > 60 ||
        /[\u0000-\u001f]/.test(body.name)
      )
        return jsonResponse({ error: 'Escribe un nombre de 2 a 60 caracteres.' }, 400);
      const secret = secretOf(request, token) ?? randomBytes(32).toString('hex');
      const record = await guestStore('join', {
        token,
        secretHash: hash(secret),
        name: body.name.trim(),
        avatarId: AVATARS[randomInt(AVATARS.length)].id,
      });
      const response = jsonResponse(guestProjection(record));
      response.cookies.set(cookieName(token), secret, {
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        path: `/api/jugar/${token}`,
        maxAge: 30 * 86400,
      });
      return response;
    }
    if (
      body.action !== 'answer' ||
      !Number.isInteger(body.index) ||
      (body.index as number) < 0 ||
      typeof body.requestId !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(body.requestId)
    )
      return jsonResponse({ error: 'Respuesta inválida.' }, 400);
    const secret = secretOf(request, token);
    if (!secret) return jsonResponse({ error: 'Vuelve a entrar con tu nombre.' }, 401);
    const secretHash = hash(secret);
    const current = await guestStore('read', { token, secretHash });
    const question = current.quiz.questions[body.index as number];
    if (!current.run || !question)
      return jsonResponse({ error: 'Actualiza la práctica para continuar.' }, 409);
    let points: number;
    try {
      const score = scoreQuestion(question, body.answer as AnswerValue);
      if (!score) throw new Error('Invalid answer');
      points = numeric(score);
    } catch {
      return jsonResponse({ error: 'Completa una respuesta válida antes de enviarla.' }, 400);
    }
    const result = {
      requestId: body.requestId,
      points,
      maximum: question.points,
      explanation: question.explanation || 'Continúa con la siguiente pregunta.',
    };
    const record = await guestStore('answer', { token, secretHash, index: body.index, result });
    return jsonResponse({
      ...guestProjection(record),
      feedback: record.run?.answers[body.index as number],
    });
  } catch (error) {
    const failure = guestError(error);
    return jsonResponse({ error: failure.message }, failure.status);
  }
}
