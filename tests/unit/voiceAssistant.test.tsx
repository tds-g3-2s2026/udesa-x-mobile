import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Turn, TurnRequest } from '../../src/features/assistant/assistantService';
import { VoiceAssistant } from '../../src/features/assistant/components/VoiceAssistant';
import { describeAction } from '../../src/features/assistant/useAssistant';
import { runRequest } from '../../src/features/assistant/runRequest';
import { AssistantDeps, Confirmation, Proposal } from '../../src/features/assistant/voiceExecutor';
import { FeedItem } from '../../src/types/post';

const recognizer = jest.requireMock('expo-speech-recognition') as {
  __emit: (name: string, event: unknown) => void;
};
const recognition = ExpoSpeechRecognitionModule as unknown as {
  isRecognitionAvailable: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
};

function post(n: number, author: string, content: string): FeedItem {
  return {
    id: `post-${n}`,
    authorId: `author-${n}`,
    authorHandle: `@${author.toLowerCase()}`,
    authorDisplayName: author,
    authorAvatarUrl: null,
    authorDeleted: false,
    content,
    images: [],
    deleted: false,
    createdAt: '2026-11-19T11:55:00Z',
    likesCount: 0,
    likedByMe: false,
    savedByMe: false,
    retweetedByMe: false,
    retweetedBy: null,
    entryId: `post:post-${n}`,
    activityAt: '2026-11-19T11:55:00Z',
    retweetsCount: 0,
    repliesCount: 0,
  };
}

const FEED = [post(1, 'Ana', 'Mañana hay parcial'), post(2, 'Fede', 'Salió la app nueva')];

function fakeDeps(confirm: (proposal: Proposal) => Promise<Confirmation>) {
  return {
    getFeed: jest.fn(async () => ({ items: FEED, nextCursor: null })),
    getPost: jest.fn(),
    getReplies: jest.fn(),
    like: jest.fn(async () => {}),
    unlike: jest.fn(),
    retweet: jest.fn(async () => {}),
    reply: jest.fn(),
    compose: jest.fn(async () => {}),
    search: jest.fn(),
    getProfile: jest.fn(),
    getProfilePosts: jest.fn(),
    follow: jest.fn(),
    getPreferences: jest.fn(),
    setTheme: jest.fn(),
    setFeedLanguage: jest.fn(),
    confirm,
    errorMessage: () => 'No se pudo',
  } as unknown as jest.Mocked<AssistantDeps>;
}

function turn(action: string, args: Record<string, string>, needsConfirmation = false): Turn {
  return { action, arguments: args, needsConfirmation, finished: action === 'finish' };
}

// The assistant on the feed, with a scripted server and services that never
// leave the test.
function renderAssistant(
  turns: Turn[],
  onClosed = jest.fn(),
  configure: (deps: jest.Mocked<AssistantDeps>) => void = () => {}
) {
  let deps: jest.Mocked<AssistantDeps> | undefined;
  const sent: TurnRequest[] = [];
  const client = {
    takeTurn: jest.fn(async (body: TurnRequest) => {
      sent.push(body);
      const next = turns.shift();
      if (!next) throw new Error('El asistente no está disponible.');
      return next;
    }),
  };
  render(
    <VoiceAssistant
      onClosed={onClosed}
      createDeps={(confirm) => {
        deps = fakeDeps(confirm);
        configure(deps);
        return deps;
      }}
      run={(request, executor, signal, hooks) =>
        runRequest(request, executor, signal, hooks, client)
      }
    />
  );
  return { deps: () => deps as jest.Mocked<AssistantDeps>, sent, client };
}

async function say(text: string) {
  await act(async () => {
    fireEvent(screen.getByTestId('assistant-mic'), 'pressIn');
  });
  act(() => recognizer.__emit('result', { isFinal: false, results: [{ transcript: text }] }));
  expect(screen.getByTestId('assistant-listening')).toHaveTextContent(text);
  fireEvent(screen.getByTestId('assistant-mic'), 'pressOut');
  await act(async () => recognizer.__emit('end', {}));
}

describe('VoiceAssistant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recognition.isRecognitionAvailable.mockReturnValue(true);
    recognition.requestPermissionsAsync.mockResolvedValue({ granted: true });
  });

  it('AI-05 - shows what the assistant understood', async () => {
    const { deps } = renderAssistant([
      turn('like_post', { ref: 'p2' }),
      turn('finish', { say: 'Listo, le di like al post de Fede.' }),
    ]);

    await say('dale like al post de Fede');

    expect(recognition.start).toHaveBeenCalledWith({
      lang: 'es-AR',
      interimResults: true,
      continuous: false,
    });
    expect(recognition.stop).toHaveBeenCalled();
    expect(await screen.findByTestId('assistant-said')).toHaveTextContent(
      'Listo, le di like al post de Fede.'
    );
    expect(screen.getByTestId('assistant-heard')).toHaveTextContent(
      'Entendí: “dale like al post de Fede”'
    );
    expect(deps().like).toHaveBeenCalledWith('post-2');
    expect(screen.getByTestId('assistant-highlighted')).toHaveTextContent(
      /^Fede ♥Salió la app nueva$/
    );
    expect(Speech.speak).toHaveBeenCalledWith('Listo, le di like al post de Fede.', {
      language: 'es-AR',
    });
  });

  it('asks before posting, with the text the user can still edit', async () => {
    const { deps } = renderAssistant([
      turn('compose_post', { text: 'Llego tarde' }, true),
      turn('finish', { say: 'Listo, publiqué.' }),
    ]);

    await say('publicá que llego tarde');

    expect(await screen.findByTestId('assistant-confirm')).toHaveTextContent(/^¿Publico esto\?/);
    fireEvent.changeText(screen.getByLabelText('Texto a publicar'), 'Llego tarde, perdón');
    await act(async () => fireEvent.press(screen.getByText('Confirmar')));

    expect(await screen.findByTestId('assistant-said')).toHaveTextContent('Listo, publiqué.');
    expect(deps().compose).toHaveBeenCalledWith('Llego tarde, perdón');
  });

  it('a cancelled confirmation does nothing and ends the request', async () => {
    const { deps, client } = renderAssistant([turn('retweet_post', { ref: 'p1' }, true)]);

    await say('retuiteá el primero');
    await screen.findByTestId('assistant-confirm');
    await act(async () => fireEvent.press(screen.getByText('Cancelar')));

    expect(await screen.findByTestId('assistant-said')).toHaveTextContent(
      'Listo, no hice nada más.'
    );
    expect(deps().retweet).not.toHaveBeenCalled();
    expect(client.takeTurn).toHaveBeenCalledTimes(1);
  });

  it('cuts a request while it waits for a confirmation', async () => {
    const { deps } = renderAssistant([turn('retweet_post', { ref: 'p1' }, true)]);

    await say('retuiteá el primero');
    await screen.findByTestId('assistant-confirm');
    await act(async () => fireEvent.press(screen.getByLabelText('Cortar el pedido')));

    expect(await screen.findByTestId('assistant-said')).toHaveTextContent(
      'Listo, no hice nada más.'
    );
    expect(deps().retweet).not.toHaveBeenCalled();
    expect(Speech.stop).toHaveBeenCalled();
  });

  it('says why when the assistant cannot answer', async () => {
    renderAssistant([]);

    await say('dale like');

    expect(await screen.findByTestId('assistant-said')).toHaveTextContent(
      'El asistente no está disponible.'
    );
    expect(Speech.speak).toHaveBeenCalledWith('El asistente no está disponible.', {
      language: 'es-AR',
    });
  });

  it('closes the panel and lets the feed reload', async () => {
    const onClosed = jest.fn();
    renderAssistant([turn('finish', { say: 'Hola.' })], onClosed);

    await say('hola');
    await screen.findByTestId('assistant-said');
    fireEvent.press(screen.getByLabelText('Cerrar el asistente'));

    expect(onClosed).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('assistant-heard')).toBeNull());
  });

  it('says so when the feed does not load', async () => {
    renderAssistant([], jest.fn(), (deps) => deps.getFeed.mockRejectedValue(new Error('sin red')));

    await say('dale like');

    expect(await screen.findByTestId('assistant-said')).toHaveTextContent(
      'No pude cargar el feed. Probá de nuevo en un rato.'
    );
  });

  it('shows the accounts it found and the preferences it changed', async () => {
    renderAssistant(
      [
        turn('search', { query: 'Ana' }),
        turn('set_preference', { name: 'theme', value: 'dark' }),
        turn('finish', { say: 'Listo.' }),
      ],
      jest.fn(),
      (deps) => {
        deps.search.mockResolvedValue({
          posts: [],
          accounts: [{ id: 'user-1', handle: '@ana', name: 'Ana', following: true }],
        });
        deps.setTheme.mockResolvedValue();
        deps.getPreferences.mockResolvedValue({ theme: 'dark', feedLanguage: 'all' });
      }
    );

    await say('buscá a Ana y poné el modo oscuro');

    await screen.findByTestId('assistant-said');
    expect(screen.getByText('Tema oscuro · Idioma del feed: all')).toBeTruthy();
  });

  it('asks for the microphone, and explains when it is not granted', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    recognition.requestPermissionsAsync.mockResolvedValueOnce({ granted: false });
    renderAssistant([]);

    await act(async () => fireEvent(screen.getByTestId('assistant-mic'), 'pressIn'));

    expect(recognition.start).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Hace falta el micrófono', expect.any(String));
  });

  it('says so when the phone has no recognizer', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    recognition.isRecognitionAvailable.mockReturnValueOnce(false);
    renderAssistant([]);

    await act(async () => fireEvent(screen.getByTestId('assistant-mic'), 'pressIn'));

    expect(recognition.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Sin reconocimiento de voz', expect.any(String));
  });

  it('does not start when the button was released before the permission was answered', async () => {
    renderAssistant([]);

    await act(async () => {
      fireEvent(screen.getByTestId('assistant-mic'), 'pressIn');
      fireEvent(screen.getByTestId('assistant-mic'), 'pressOut');
    });

    expect(recognition.start).not.toHaveBeenCalled();
  });

  it('stays quiet when nothing was said, and warns on any other error', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { client } = renderAssistant([]);

    act(() => recognizer.__emit('error', { error: 'no-speech', message: '' }));
    act(() => recognizer.__emit('end', {}));
    expect(alert).not.toHaveBeenCalled();
    expect(client.takeTurn).not.toHaveBeenCalled();

    act(() => recognizer.__emit('error', { error: 'network', message: 'sin red' }));
    expect(alert).toHaveBeenCalledWith('No te pude escuchar', expect.any(String));
  });

  it('names what it is doing in the words of the user', () => {
    expect(
      ['scroll_feed', 'refresh_feed', 'open_post', 'like_post', 'unlike_post', 'retweet_post']
        .concat(['reply_to_post', 'compose_post', 'open_profile', 'follow', 'set_preference', 'x'])
        .map((action) => describeAction(turn(action, {})))
    ).toEqual([
      'Bajando en el feed',
      'Volviendo al principio del feed',
      'Abriendo el post',
      'Dando like',
      'Sacando el like',
      'Retuiteando',
      'Respondiendo',
      'Publicando',
      'Abriendo el perfil',
      'Siguiendo la cuenta',
      'Cambiando la preferencia',
      'Trabajando',
    ]);
    expect(describeAction(turn('scroll_feed', { direction: 'up' }))).toBe('Subiendo en el feed');
    expect(describeAction(turn('search', { query: 'torneo' }))).toBe('Buscando "torneo"');
  });
});
