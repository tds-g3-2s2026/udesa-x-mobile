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
    const follow = jest.spyOn(followService, 'follow').mockResolvedValue('following');
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

  it('E3-H1.CA2 - a protected account leaves the button on "Solicitado"', async () => {
    // posts-api answers 202: the relationship was asked for, not established.
    const follow = jest.spyOn(followService, 'follow').mockResolvedValue('pending');
    const onStateChange = jest.fn();

    render(<FollowButton targetUserId="usr-2" initialState="none" onStateChange={onStateChange} />);

    await act(async () => {
      fireEvent.press(screen.getByText('Seguir'));
    });

    expect(follow).toHaveBeenCalledWith('usr-2');
    // Not "Siguiendo": nobody approved anything yet, and saying so would lie.
    expect(await screen.findByText('Solicitado')).toBeTruthy();
    expect(onStateChange).toHaveBeenCalledWith('pending');
  });

  it('a request already sent cannot be pressed again', async () => {
    // Cancelling it needs unfollowing to cancel a pending request, which is
    // the piece of E3-H2 that is not in yet. Until then the button waits.
    const unfollow = jest.spyOn(followService, 'unfollow').mockResolvedValue(undefined);

    render(<FollowButton targetUserId="usr-2" initialState="pending" />);

    await act(async () => {
      fireEvent.press(screen.getByText('Solicitado'));
    });

    expect(unfollow).not.toHaveBeenCalled();
    expect(screen.getByText('Solicitado')).toBeTruthy();
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
