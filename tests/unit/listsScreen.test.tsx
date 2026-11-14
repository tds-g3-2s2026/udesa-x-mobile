import { useEffect as mockUseEffect } from 'react';
import { Alert, type AlertButton } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ListsScreen from '../../app/(app)/lists/index';
import { listService } from '../../src/features/lists/services/listService';
import { ApiError } from '../../src/api/apiClient';
import { AccountList } from '../../src/types/lists';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  // No navigator here: the focus effect runs once on mount, as on a screen
  // that was already focused when it appeared.
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockUseEffect(() => effect(), []);
  },
}));

const initialMetrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ListsScreen />
    </SafeAreaProvider>
  );
}

function list(id: string, name: string, membersCount = 0): AccountList {
  return { id, name, membersCount, createdAt: '2026-11-12T12:00:00Z' };
}

// Deleting asks first: the confirm button of the prompt, pressed by hand.
async function confirmDeletion(name: string) {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  fireEvent.press(screen.getByLabelText(`Borrar ${name}`));
  const buttons = alert.mock.calls[0][2] as AlertButton[];
  await act(async () => {
    buttons.find((button) => button.text === 'Borrar')?.onPress?.();
  });
  return alert;
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('E3-H8. Listas Personalizadas', () => {
  it('shows the lists of the caller with how many accounts each has', async () => {
    jest
      .spyOn(listService, 'getLists')
      .mockResolvedValue([list('lst-1', 'Taller', 1), list('lst-2', 'Fútbol', 3)]);

    renderScreen();

    expect(await screen.findByText('Taller')).toBeTruthy();
    expect(screen.getByText('1 cuenta')).toBeTruthy();
    expect(screen.getByText('3 cuentas')).toBeTruthy();
  });

  it('E3-H8.CA2 - opens the feed of a list with its name', async () => {
    jest.spyOn(listService, 'getLists').mockResolvedValue([list('lst-1', 'Taller', 1)]);

    renderScreen();
    fireEvent.press(await screen.findByLabelText('Abrir Taller'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/lists/[id]',
      params: { id: 'lst-1', name: 'Taller' },
    });
  });

  it('creates a list with the trimmed name', async () => {
    jest.spyOn(listService, 'getLists').mockResolvedValue([]);
    const create = jest.spyOn(listService, 'createList').mockResolvedValue(list('lst-9', 'Amigos'));

    renderScreen();
    expect(await screen.findByText('Todavía no tenés listas')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Nombre de una lista nueva'), '  Amigos ');
    fireEvent.press(screen.getByLabelText('Crear lista'));

    expect(await screen.findByText('Amigos')).toBeTruthy();
    expect(create).toHaveBeenCalledWith('Amigos');
    expect(screen.getByLabelText('Nombre de una lista nueva').props.value).toBe('');
  });

  it('E3-H8.CA4 - deleting a list asks first and leaves the others', async () => {
    jest
      .spyOn(listService, 'getLists')
      .mockResolvedValue([list('lst-1', 'Taller'), list('lst-2', 'Fútbol')]);
    const remove = jest.spyOn(listService, 'deleteList').mockResolvedValue(undefined);
    renderScreen();
    await screen.findByText('Taller');

    const alert = await confirmDeletion('Taller');

    expect(alert.mock.calls[0][1]).toContain('siguen apareciendo en tu feed principal');
    expect(remove).toHaveBeenCalledWith('lst-1');
    await waitFor(() => expect(screen.queryByText('Taller')).toBeNull());
    expect(screen.getByText('Fútbol')).toBeTruthy();
  });

  it('keeps the list and says why when deleting fails', async () => {
    jest.spyOn(listService, 'getLists').mockResolvedValue([list('lst-1', 'Taller')]);
    jest
      .spyOn(listService, 'deleteList')
      .mockRejectedValue(new ApiError('No se pudo borrar la lista. Intentalo de nuevo.'));
    renderScreen();
    await screen.findByText('Taller');

    const alert = await confirmDeletion('Taller');

    expect(alert).toHaveBeenLastCalledWith(
      'Error',
      'No se pudo borrar la lista. Intentalo de nuevo.'
    );
    expect(screen.getByText('Taller')).toBeTruthy();
  });

  it('keeps the name and says why when a list cannot be created', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(listService, 'getLists').mockResolvedValue([]);
    jest
      .spyOn(listService, 'createList')
      .mockRejectedValue(new ApiError('Podés tener hasta 20 listas'));

    renderScreen();
    await screen.findByText('Todavía no tenés listas');
    fireEvent.changeText(screen.getByLabelText('Nombre de una lista nueva'), 'Otra');
    fireEvent.press(screen.getByLabelText('Crear lista'));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Error', 'Podés tener hasta 20 listas'));
    expect(screen.getByLabelText('Nombre de una lista nueva').props.value).toBe('Otra');
  });

  it('shows the list being deleted as busy until the server answers', async () => {
    jest.spyOn(listService, 'getLists').mockResolvedValue([list('lst-1', 'Taller')]);
    let finish: () => void = () => {};
    jest
      .spyOn(listService, 'deleteList')
      .mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderScreen();
    await screen.findByText('Taller');

    await confirmDeletion('Taller');

    expect(screen.queryByLabelText('Borrar Taller')).toBeNull();
    await act(async () => finish());
    await waitFor(() => expect(screen.queryByText('Taller')).toBeNull());
  });

  it('ignores lists that arrive after leaving the screen', async () => {
    let answer: (lists: AccountList[]) => void = () => {};
    const getLists = jest
      .spyOn(listService, 'getLists')
      .mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { unmount } = renderScreen();

    unmount();
    await act(async () => answer([list('lst-1', 'Taller')]));

    expect(getLists).toHaveBeenCalledTimes(1);
  });

  it('goes back', async () => {
    jest.spyOn(listService, 'getLists').mockResolvedValue([]);

    renderScreen();
    fireEvent.press(await screen.findByText(/Volver/));

    expect(mockBack).toHaveBeenCalled();
  });

  it('says why the lists could not be read', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest
      .spyOn(listService, 'getLists')
      .mockRejectedValue(new ApiError('No se pudieron cargar tus listas. Intentalo de nuevo.'));

    renderScreen();

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudieron cargar tus listas. Intentalo de nuevo.'
      )
    );
  });
});
