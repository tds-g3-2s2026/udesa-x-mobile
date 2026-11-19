import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { createAppDeps } from './appDeps';
import { View } from './assistantView';
import { Turn } from './assistantService';
import { runRequest } from './runRequest';
import { AssistantDeps, Confirmation, Proposal, VoiceExecutor } from './voiceExecutor';

export type Phase = 'idle' | 'working' | 'confirming' | 'done' | 'failed';

export interface AssistantState {
  phase: Phase;
  // What the recognizer heard, shown back so the user knows what it understood.
  heard: string;
  doing: string | null;
  said: string | null;
  proposal: Proposal | null;
  snapshot: { view: View; highlightedId: string | null } | null;
}

const IDLE: AssistantState = {
  phase: 'idle',
  heard: '',
  doing: null,
  said: null,
  proposal: null,
  snapshot: null,
};

export interface AssistantOptions {
  createDeps?: (confirm: (proposal: Proposal) => Promise<Confirmation>) => AssistantDeps;
  run?: typeof runRequest;
  speak?: (text: string) => void;
}

function speakAloud(text: string): void {
  Speech.speak(text, { language: 'es-AR' });
}

// One spoken request at a time: it runs the steps, asks for confirmation when
// the executor needs it, and reads the answer aloud at the end.
export function useAssistant({
  createDeps = createAppDeps,
  run = runRequest,
  speak = speakAloud,
}: AssistantOptions = {}) {
  const [state, setState] = useState<AssistantState>(IDLE);
  const controller = useRef<AbortController | null>(null);
  const answer = useRef<((confirmation: Confirmation) => void) | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  const update = useCallback((change: Partial<AssistantState>) => {
    if (mounted.current) setState((current) => ({ ...current, ...change }));
  }, []);

  const askToConfirm = useCallback(
    (proposal: Proposal) =>
      new Promise<Confirmation>((resolve) => {
        answer.current = resolve;
        update({ phase: 'confirming', proposal });
      }),
    [update]
  );

  const ask = useCallback(
    async (request: string) => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      const executor = new VoiceExecutor(createDeps(askToConfirm), () =>
        update({ snapshot: executor.current() })
      );
      setState({ ...IDLE, phase: 'working', heard: request, doing: 'Mirando el feed' });
      try {
        await executor.start();
      } catch {
        if (controller.current !== current) return;
        const said = 'No pude cargar el feed. Probá de nuevo en un rato.';
        update({ phase: 'failed', doing: null, said });
        speak(said);
        return;
      }
      update({ snapshot: executor.current() });

      const outcome = await run(request, executor, current.signal, {
        onAction: (turn) => update({ doing: describeAction(turn) }),
      });
      // A newer request took over, or the panel was closed: this one has nothing to show.
      if (controller.current !== current) return;
      if (outcome.kind === 'finished') {
        const said = outcome.say || 'Listo.';
        update({ phase: 'done', doing: null, proposal: null, said });
        speak(said);
      } else if (outcome.kind === 'cancelled') {
        update({ phase: 'done', doing: null, proposal: null, said: 'Listo, no hice nada más.' });
      } else {
        update({ phase: 'failed', doing: null, proposal: null, said: outcome.message });
        speak(outcome.message);
      }
    },
    [askToConfirm, createDeps, run, speak, update]
  );

  const confirm = useCallback(
    (confirmation: Confirmation) => {
      const resolve = answer.current;
      answer.current = null;
      update({ phase: 'working', proposal: null });
      resolve?.(confirmation);
    },
    [update]
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
    answer.current?.({ confirmed: false });
    answer.current = null;
    void Speech.stop();
  }, []);

  const close = useCallback(() => {
    cancel();
    controller.current = null;
    setState(IDLE);
  }, [cancel]);

  return { state, ask, confirm, cancel, close };
}

// What the panel says the assistant is doing, in the words of the user.
export function describeAction(turn: Turn): string {
  const { action, arguments: args } = turn;
  switch (action) {
    case 'scroll_feed':
      return args.direction === 'up' ? 'Subiendo en el feed' : 'Bajando en el feed';
    case 'refresh_feed':
      return 'Volviendo al principio del feed';
    case 'open_post':
      return 'Abriendo el post';
    case 'like_post':
      return 'Dando like';
    case 'unlike_post':
      return 'Sacando el like';
    case 'retweet_post':
      return 'Retuiteando';
    case 'reply_to_post':
      return 'Respondiendo';
    case 'compose_post':
      return 'Publicando';
    case 'search':
      return `Buscando "${args.query}"`;
    case 'open_profile':
      return 'Abriendo el perfil';
    case 'follow':
      return 'Siguiendo la cuenta';
    case 'set_preference':
      return 'Cambiando la preferencia';
    default:
      return 'Trabajando';
  }
}
