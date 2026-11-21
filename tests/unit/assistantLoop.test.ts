import { Turn, TurnRequest } from '../../src/features/assistant/assistantService';
import { runRequest } from '../../src/features/assistant/runRequest';
import { Screen, StepResult } from '../../src/features/assistant/types';

const SCREEN: Screen = { screen: 'feed', page: 1, posts: [] };

function action(name: string, args: Record<string, string> = {}, needsConfirmation = false): Turn {
  return { action: name, arguments: args, needsConfirmation, finished: false };
}

function finish(say: string): Turn {
  return { action: 'finish', arguments: { say }, needsConfirmation: false, finished: true };
}

function scripted(...turns: Turn[]) {
  const sent: TurnRequest[] = [];
  return {
    sent,
    takeTurn: jest.fn(async (body: TurnRequest) => {
      sent.push(structuredClone(body));
      const next = turns.shift();
      if (!next) throw new Error('No more turns');
      return next;
    }),
  };
}

function executor(results: StepResult[] = []) {
  return {
    describe: jest.fn(() => SCREEN),
    perform: jest.fn(async () => results.shift() ?? { ok: true, done: 'Hecho' }),
  };
}

describe('runRequest', () => {
  it('performs each action and sends what happened on the next step, until finish', async () => {
    const client = scripted(
      action('like_post', { ref: 'p1' }),
      action('retweet_post', { ref: 'p2' }, true),
      finish('Listo')
    );
    const app = executor([{ ok: true, done: 'Like dado' }]);
    const onAction = jest.fn();

    const outcome = await runRequest(
      'dale like y retuiteá',
      app,
      new AbortController().signal,
      { onAction },
      client
    );

    expect(outcome).toEqual({ kind: 'finished', say: 'Listo' });
    expect(app.perform.mock.calls).toEqual([
      ['like_post', { ref: 'p1' }, false],
      ['retweet_post', { ref: 'p2' }, true],
    ]);
    expect(client.sent[2]).toEqual({
      request: 'dale like y retuiteá',
      screen: SCREEN,
      steps: [
        { action: 'like_post', arguments: { ref: 'p1' }, result: { ok: true, done: 'Like dado' } },
        { action: 'retweet_post', arguments: { ref: 'p2' }, result: { ok: true, done: 'Hecho' } },
      ],
    });
    expect(onAction.mock.calls.map(([turn]) => turn.action)).toEqual(['like_post', 'retweet_post']);
  });

  it('AI-05 - stops when the user cancels', async () => {
    const controller = new AbortController();
    const client = scripted(action('scroll_feed', { direction: 'down' }), finish('Listo'));
    const app = executor();
    app.perform.mockImplementationOnce(async () => {
      controller.abort();
      return { ok: true, done: 'El feed se movió una pantalla' };
    });

    const outcome = await runRequest('bajá', app, controller.signal, {}, client);

    expect(outcome).toEqual({ kind: 'cancelled' });
    expect(client.takeTurn).toHaveBeenCalledTimes(1);
  });

  it('ends without asking again when the user says no to a confirmation', async () => {
    const client = scripted(action('retweet_post', { ref: 'p1' }, true), finish('Listo'));
    const app = executor([{ ok: false, cancelled: true, error: 'El usuario no lo confirmó' }]);

    const outcome = await runRequest('retuiteá', app, new AbortController().signal, {}, client);

    expect(outcome).toEqual({ kind: 'cancelled' });
    expect(client.takeTurn).toHaveBeenCalledTimes(1);
  });

  it('does not start a request that was already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const client = scripted(finish('Listo'));

    expect(await runRequest('hola', executor(), controller.signal, {}, client)).toEqual({
      kind: 'cancelled',
    });
    expect(client.takeTurn).not.toHaveBeenCalled();
  });

  it('drops an answer that arrives after cancelling', async () => {
    const controller = new AbortController();
    const client = {
      takeTurn: jest.fn(async () => {
        controller.abort();
        return action('like_post', { ref: 'p1' });
      }),
    };
    const app = executor();

    expect(await runRequest('dale like', app, controller.signal, {}, client)).toEqual({
      kind: 'cancelled',
    });
    expect(app.perform).not.toHaveBeenCalled();
  });

  it('reports why the assistant could not answer', async () => {
    const client = { takeTurn: jest.fn(async () => Promise.reject(new Error('Sin conexión'))) };

    expect(await runRequest('hola', executor(), new AbortController().signal, {}, client)).toEqual({
      kind: 'failed',
      message: 'Sin conexión',
    });
  });

  it('a failure after cancelling is still a cancellation', async () => {
    const controller = new AbortController();
    const client = {
      takeTurn: jest.fn(async () => {
        controller.abort();
        throw new Error('canceled');
      }),
    };

    expect(await runRequest('hola', executor(), controller.signal, {}, client)).toEqual({
      kind: 'cancelled',
    });
  });

  it('gives up if the server never finishes', async () => {
    const client = { takeTurn: jest.fn(async () => action('scroll_feed', { direction: 'down' })) };

    const outcome = await runRequest('bajá', executor(), new AbortController().signal, {}, client);

    expect(outcome).toMatchObject({ kind: 'failed' });
    expect(client.takeTurn).toHaveBeenCalledTimes(9);
  });

  it('reads an empty finish as silence', async () => {
    const client = {
      takeTurn: jest.fn(async () => ({ ...finish(''), arguments: {} })),
    };

    expect(await runRequest('hola', executor(), new AbortController().signal, {}, client)).toEqual({
      kind: 'finished',
      say: '',
    });
  });
});
