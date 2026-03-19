import { FastifyRequest, FastifyReply } from 'fastify';
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  parseExpiresInToMs,
} from '../../../lib/token.js';
import { findSessionByRefreshToken, updateSessionTokens } from '../repositories/auth.repository.js';
import { env } from '../../../config/env.js';
import prisma from '#database';

export async function refreshController(req: FastifyRequest, reply: FastifyReply) {
  const refreshToken = req.cookies['refreshToken'];

  if (!refreshToken) {
    return reply.status(401).send({
      success: false,
      message: 'Nao autorizado',
      statusCode: 401,
    });
  }

  try {
    const isRefreshTokenValid = verifyRefreshToken(refreshToken);

  } catch {
    reply.clearCookie('accessToken', { path: '/' });
    reply.clearCookie('refreshToken', { path: '/' });
    return reply.status(401).send({
      success: false,
      message: 'Refresh token invalido ou expirado',
      statusCode: 401,
    });
  }

  const session = await findSessionByRefreshToken(refreshToken);
  if (!session) {
    reply.clearCookie('accessToken', { path: '/' });
    reply.clearCookie('refreshToken', { path: '/' });
    return reply.status(401).send({
      success: false,
      message: 'Sessao nao encontrada',
      statusCode: 401,
    });
  }

  const newRefreshToken = generateRefreshToken(session.userId);
  const refreshExpiresAt = new Date(Date.now() + parseExpiresInToMs(env.JWT_REFRESH_EXPIRES_IN));

  await updateSessionTokens(session.id, { refreshToken: newRefreshToken, refreshExpiresAt });

  const accessToken = generateAccessToken(session.userId);

  reply.setCookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,

  });

  reply.setCookie('accessToken', accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 15,
  });

  return reply.status(200).send({
    success: true,
    message: 'Token renovado com sucesso',
    statusCode: 200,
  });
}
