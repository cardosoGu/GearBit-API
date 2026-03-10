import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, verifyRefreshToken } from '../../../lib/token';

export async function notLoggedMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const accessToken = request.cookies['accessToken'];
  const refreshToken = request.cookies['refreshToken'];

  // if tokens = null, pass
  if (!accessToken && !refreshToken) return;

  // verifica accessToken
  if (accessToken) {
    try {
      const isValid = verifyAccessToken(accessToken);
      if (isValid) {
        return reply.status(400).send({
          success: false,
          message: 'Usuario já está autenticado',
        });
      }
    } catch {
      // token inválido ou expirado, deixa passar
    }
  }

  //verify refreshToken
  if (refreshToken && !accessToken) {
    try {
      const isValid = verifyRefreshToken(refreshToken);
      if (isValid) {
        return reply.status(400).send({
          success: false,
          message: 'Usuario já autenticado',
        });
      }
    } catch {
      // token inválido ou expirado, deixa passar
    }
  }

  return
}
