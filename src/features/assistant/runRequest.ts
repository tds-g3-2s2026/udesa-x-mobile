import axios from 'axios';
import { getAuthErrorMessage } from '../../api/apiClient';
import { PastStep, Turn, TurnRequest, assistantService } from './assistantService';
import { VoiceExecutor } from './voiceExecutor';

// The server ends a request at eight steps. This only stops a client that
// keeps asking if a server ever does not.
const MAX_TURNS = 9;

export type Outcome =
  { kind: 'finished'; say: string } | { kind: 'cancelled' } | { kind: 'failed'; message: string };

export interface RequestHooks {
  // Right before the app performs an action: what the panel shows it doing.
  onAction?(turn: Turn): void;
}

export interface TurnClient {
  takeTurn(body: TurnRequest, signal?: AbortSignal): Promise<Turn>;
}

// Carries out one spoken request: asks the server for the next action, performs
// it and reports what happened, until the server says `finish`. Cancelling
// stops between steps, so an action is never left half done.
export async function runRequest(
  request: string,
  executor: Pick<VoiceExecutor, 'describe' | 'perform'>,
  signal: AbortSignal,
  hooks: RequestHooks = {},
  client: TurnClient = assistantService
): Promise<Outcome> {
  const steps: PastStep[] = [];
  try {
    for (let turns = 0; turns < MAX_TURNS; turns += 1) {
      if (signal.aborted) return { kind: 'cancelled' };
      const turn = await client.takeTurn({ request, screen: executor.describe(), steps }, signal);
      if (signal.aborted) return { kind: 'cancelled' };
      if (turn.finished) return { kind: 'finished', say: turn.arguments.say ?? '' };

      hooks.onAction?.(turn);
      const result = await executor.perform(turn.action, turn.arguments, turn.needsConfirmation);
      if (result.cancelled || signal.aborted) return { kind: 'cancelled' };
      steps.push({ action: turn.action, arguments: turn.arguments, result });
    }
    return {
      kind: 'failed',
      message: 'El pedido llevó demasiados pasos. Probá con uno más corto.',
    };
  } catch (error) {
    if (signal.aborted || axios.isCancel(error)) return { kind: 'cancelled' };
    return { kind: 'failed', message: getAuthErrorMessage(error) };
  }
}
