import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AddToListModal } from '../../src/features/lists/components/AddToListModal';
import { listService } from '../../src/features/lists/services/listService';
import { ApiError } from '../../src/api/apiClient';
import { AccountList } from '../../src/types/lists';

jest.mock('../../src/features/lists/services/listService', () => ({
  listService: {
    getLists: jest.fn(),
    getMembers: jest.fn(),
    createList: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
  },
}));

const service = jest.mocked(listService);

function list(id: string, name: string, membersCount = 0): AccountList {
  return { id, name, membersCount, createdAt: '2026-11-12T12:00:00Z' };
}

function renderModal(onClose = jest.fn()) {
  render(<AddToListModal accountId="usr-2" handle="@ana" visible onClose={onClose} />);
  return onClose;
}

// The modal reads the members of each list to know where the account already is.
function given(lists: AccountList[], listsWithAccount: string[] = []) {
  service.getLists.mockResolvedValue(lists);
  service.getMembers.mockImplementation(async (listId) =>
    listsWithAccount.includes(listId)
      ? [{ id: 'usr-2', handle: '@ana', addedAt: '2026-11-12T13:00:00Z' }]
      : []
  );
}

describe('AddToListModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service.addMember.mockResolvedValue(undefined);
    service.removeMember.mockResolvedValue(undefined);
  });

  it('marks the lists the account is already in', async () => {
    given([list('lst-1', 'Taller', 1), list('lst-2', 'Fútbol')], ['lst-1']);

    renderModal();

    expect(await screen.findByRole('checkbox', { name: 'Taller' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Fútbol' })).not.toBeChecked();
    expect(screen.getByText('Agregar @ana a una lista')).toBeTruthy();
  });

  it('E3-H8.CA1 - puts the same account in two lists', async () => {
    given([list('lst-1', 'Taller'), list('lst-2', 'Fútbol')]);
    renderModal();

    fireEvent.press(await screen.findByRole('checkbox', { name: 'Taller' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Taller' })).toBeChecked());
    fireEvent.press(screen.getByRole('checkbox', { name: 'Fútbol' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Fútbol' })).toBeChecked());
    expect(service.addMember).toHaveBeenCalledWith('lst-1', 'usr-2');
    expect(service.addMember).toHaveBeenCalledWith('lst-2', 'usr-2');
    expect(screen.getAllByText('1 cuenta')).toHaveLength(2);
  });

  it('takes the account out of a list it was in', async () => {
    given([list('lst-1', 'Taller', 3)], ['lst-1']);
    renderModal();

    fireEvent.press(await screen.findByRole('checkbox', { name: 'Taller' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Taller' })).not.toBeChecked());
    expect(service.removeMember).toHaveBeenCalledWith('lst-1', 'usr-2');
    expect(screen.getByText('2 cuentas')).toBeTruthy();
  });

  it('creates a list with the account already in it', async () => {
    given([]);
    service.createList.mockResolvedValue(list('lst-9', 'Amigos'));
    renderModal();

    expect(await screen.findByText('Todavía no tenés listas. Creá una acá abajo.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Nombre de una lista nueva'), '  Amigos  ');
    fireEvent.press(screen.getByRole('button', { name: 'Crear lista' }));

    expect(await screen.findByRole('checkbox', { name: 'Amigos' })).toBeChecked();
    expect(service.createList).toHaveBeenCalledWith('Amigos');
    expect(service.addMember).toHaveBeenCalledWith('lst-9', 'usr-2');
  });

  it('shows why a change was refused and leaves the list as it was', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    given([list('lst-1', 'Taller', 100)]);
    service.addMember.mockRejectedValue(new ApiError('Una lista puede tener hasta 100 cuentas'));
    renderModal();

    fireEvent.press(await screen.findByRole('checkbox', { name: 'Taller' }));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Error', 'Una lista puede tener hasta 100 cuentas')
    );
    expect(screen.getByRole('checkbox', { name: 'Taller' })).not.toBeChecked();
  });

  it('keeps the name and says why when a list cannot be created', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    given([]);
    service.createList.mockRejectedValue(new ApiError('Podés tener hasta 20 listas'));
    renderModal();

    fireEvent.changeText(await screen.findByLabelText('Nombre de una lista nueva'), 'Una más');
    fireEvent.press(screen.getByRole('button', { name: 'Crear lista' }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Error', 'Podés tener hasta 20 listas'));
    expect(screen.getByLabelText('Nombre de una lista nueva').props.value).toBe('Una más');
    expect(service.addMember).not.toHaveBeenCalled();
  });

  it('ignores lists that arrive after it was closed', async () => {
    let answer: (lists: AccountList[]) => void = () => {};
    service.getLists.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { unmount } = render(
      <AddToListModal accountId="usr-2" handle="@ana" visible onClose={jest.fn()} />
    );

    unmount();
    answer([list('lst-1', 'Taller')]);

    await waitFor(() => expect(service.getMembers).toHaveBeenCalledTimes(1));
  });

  it('says when the lists cannot be read', async () => {
    service.getLists.mockRejectedValue(new ApiError('No se pudieron cargar tus listas.'));

    renderModal();

    expect(await screen.findByText('No se pudieron cargar tus listas.')).toBeTruthy();
  });

  it('closes with Listo', async () => {
    given([]);
    const onClose = renderModal();

    fireEvent.press(await screen.findByText('Listo'));

    expect(onClose).toHaveBeenCalled();
  });
});
