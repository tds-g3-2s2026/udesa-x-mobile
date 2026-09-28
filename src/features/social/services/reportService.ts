import { ApiError, toAuthError } from '../../../api/apiClient';
import { postsApiClient } from '../../../api/postsApiClient';
import { ReportReason, ReportTarget } from '../../../types/social';

// The server's own sentence says "en las últimas 24 horas", which reads like
// a rule being quoted. This one tells the user what happened and when they
// can do it again.
export const ALREADY_REPORTED_MESSAGE =
  'Ya denunciaste esta cuenta hace poco. Podés volver a hacerlo en 24 horas.';

export const reportService = {
  async report(target: ReportTarget, reason: ReportReason): Promise<void> {
    try {
      await postsApiClient.post('/reports', { ...target, reason });
    } catch (error) {
      const failure = toAuthError(error, 'No se pudo enviar la denuncia. Intentalo de nuevo.');
      if (failure instanceof ApiError && failure.code === 'already-reported') {
        throw new ApiError(ALREADY_REPORTED_MESSAGE, failure.code);
      }
      throw failure;
    }
  },
};
