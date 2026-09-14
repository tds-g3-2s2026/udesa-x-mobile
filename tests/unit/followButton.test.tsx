import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FollowButton } from '../../src/features/social/components/FollowButton';
import { followService } from '../../src/features/social/services/followService';
import { ApiError } from '../../src/api/apiClient';

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('E3-H1. Seguir a un Usuario', () => {
  it('E3-H1.CA1 - starts on "Seguir" and follows the target when pressed', async () => {
    const follow = jest.spyOn(followService, 'follow').mockResolvedValue(undefined);
    const onStateChange = jest.fn();

    render(<FollowButton targetUserId="usr-2" initialState="none" onStateChange={onStateChange} />);
    expect(screen.getByText('Seguir')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('Seguir'));
    });

    expect(follow).toHaveBeenCalledWith('usr-2');
    expect(await screen.findByText('Siguiendo')).toBeTruthy();
    expect(onStateChange).toHaveBeenCalledWith('following');
  });

  it('unfollows the target when already following and pressed again', async () => {
    const unfollow = jest.spyOn(followService, 'unfollow').mockResolvedValue(undefined);
    const onStateChange = jest.fn();

    render(
      <FollowButton targetUserId="usr-2" initialState="following" onStateChange={onStateChange} />
    );
    expect(screen.getByText('Siguiendo')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('Siguiendo'));
    });

    expect(unfollow).toHaveBeenCalledWith('usr-2');
    expect(await screen.findByText('Seguir')).toBeTruthy();
    expect(onStateChange).toHaveBeenCalledWith('none');
  });

  it('a protected account shows a specific message and leaves the button on "Seguir"', async () => {
    jest
      .spyOn(followService, 'follow')
      .mockRejectedValue(
        new ApiError(
          'La cuenta es protegida y todavía no se pueden enviar solicitudes',
          'follow-needs-approval'
        )
      );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    render(<FollowButton targetUserId="usr-2" initialState="none" />);

    await act(async () => {
      fireEvent.press(screen.getByText('Seguir'));
    });

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Cuenta protegida',
        'Esta cuenta es protegida y todavía no se pueden enviar solicitudes para seguirla.'
      )
    );
    // The follow was refused: the button must not claim it worked.
    expect(screen.getByText('Seguir')).toBeTruthy();
  });

  it('a rate limit or other API failure shows its own message and leaves the state untouched', async () => {
    jest
      .spyOn(followService, 'follow')
      .mockRejectedValue(
        new ApiError('Alcanzaste el límite de 50 por hora. Probá más tarde.', 'too-many-follows')
      );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    render(<FollowButton targetUserId="usr-2" initialState="none" />);

    await act(async () => {
      fireEvent.press(screen.getByText('Seguir'));
    });

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'Alcanzaste el límite de 50 por hora. Probá más tarde.'
      )
    );
    expect(screen.getByText('Seguir')).toBeTruthy();
  });
});
