import axios from 'axios';
import { assistantApiClient } from '../../api/assistantApiClient';
import { ApiError, toAuthError } from '../../api/apiClient';
import { ActionArguments, Screen, StepResult } from './types';

export interface PastStep {
  action: string;
  arguments: ActionArguments;
  result: StepResult;
}

export interface TurnRequest {
  request: string;
  screen: Screen;
  steps: PastStep[];
}

// One step as assistant-api answers it: an action of the catalog for the app,
// or `finish` with the sentence to read aloud in `arguments.say`.
export interface Turn {
  action: string;
  arguments: ActionArguments;
  needsConfirmation: boolean;
  finished: boolean;
}

// A request the assistant could not answer, with what to tell the user.
export class AssistantUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssistantUnavailableError';
  }
}

const OFF = 'El asistente está apagado por ahora.';
const UNAVAILABLE = 'El asistente no está disponible. Probá de nuevo en un rato.';

export const assistantService = {
  async takeTurn(body: TurnRequest, signal?: AbortSignal): Promise<Turn> {
    try {
      const response = await assistantApiClient.post<Turn>('/assistant/turns', body, { signal });
      return response.data;
    } catch (error) {
      if (axios.isCancel(error)) throw error;
      throw unavailable(error);
    }
  },
};

function unavailable(error: unknown): Error {
  if (axios.isAxiosError(error) && error.response?.status === 429) {
    return new AssistantUnavailableError(limitReached(error.response.headers['retry-after']));
  }
  if (axios.isAxiosError(error) && error.response?.status === 503) {
    const code = (toAuthError(error, UNAVAILABLE) as ApiError).code;
    return new AssistantUnavailableError(code === 'assistant-off' ? OFF : UNAVAILABLE);
  }
  // Without connection, or anything else: the message the rest of the app shows.
  return toAuthError(error, UNAVAILABLE);
}

function limitReached(retryAfter: unknown): string {
  const seconds = Number(retryAfter);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'Llegaste al límite de pedidos por hora. Probá de nuevo más tarde.';
  }
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Llegaste al límite de pedidos por hora. Probá de nuevo en ${minutes} ${
    minutes === 1 ? 'minuto' : 'minutos'
  }.`;
}
