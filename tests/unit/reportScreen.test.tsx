import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReportScreen from '../../app/(app)/report';
import {
  ALREADY_REPORTED_MESSAGE,
  reportService,
} from '../../src/features/social/services/reportService';
import { ApiError } from '../../src/api/apiClient';

const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn<{ userId?: string; postId?: string; handle?: string }, []>(
  () => ({})
);

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

const initialMetrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ReportScreen />
    </SafeAreaProvider>
  );
}

async function press(label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByText(label));
  });
}

beforeEach(() => {
  mockUseLocalSearchParams.mockReturnValue({ userId: 'usr-2', handle: '@persona2' });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('E3-H5. Denunciar Usuario', () => {
  it('E3-H5.CA1 - offers exactly the four reasons of the closed list', () => {
    renderScreen();

    expect(screen.getByText('Denunciar a @persona2')).toBeTruthy();
    for (const label of ['Spam', 'Acoso', 'Contenido inapropiado', 'Suplantación de identidad']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('E3-H5.CA1 - nothing is sent until a reason is chosen', async () => {
    const report = jest.spyOn(reportService, 'report');

    renderScreen();
    await press('Enviar denuncia');

    expect(report).not.toHaveBeenCalled();
  });

  it('E3-H5.CA1 - sends the account and the chosen reason, confirms and goes back', async () => {
    const report = jest.spyOn(reportService, 'report').mockResolvedValueOnce();
    const alert = jest.spyOn(Alert, 'alert');

    renderScreen();
    await press('Acoso');
    await press('Enviar denuncia');

    expect(report).toHaveBeenCalledWith({ userId: 'usr-2' }, 'harassment');
    expect(alert).toHaveBeenCalledWith(
      'Denuncia enviada',
      'Gracias por avisarnos. La vamos a revisar.'
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it('E3-H5.CA1 - coming from a post, reports the post and not the account', async () => {
    mockUseLocalSearchParams.mockReturnValue({ postId: 'post-7', handle: '@persona2' });
    const report = jest.spyOn(reportService, 'report').mockResolvedValueOnce();

    renderScreen();
    await press('Spam');
    await press('Enviar denuncia');

    expect(report).toHaveBeenCalledWith({ postId: 'post-7' }, 'spam');
  });

  it('E3-H5.CA3 - a repeated report shows the plain message and stays on the screen', async () => {
    jest
      .spyOn(reportService, 'report')
      .mockRejectedValueOnce(new ApiError(ALREADY_REPORTED_MESSAGE, 'already-reported'));
    const alert = jest.spyOn(Alert, 'alert');

    renderScreen();
    await press('Spam');
    await press('Enviar denuncia');

    expect(alert).toHaveBeenCalledWith('No se pudo enviar la denuncia', ALREADY_REPORTED_MESSAGE);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('without an account or a post there is nothing to send', async () => {
    mockUseLocalSearchParams.mockReturnValue({});
    const report = jest.spyOn(reportService, 'report');

    renderScreen();
    expect(screen.getByText('Denunciar a esta cuenta')).toBeTruthy();
    await press('Spam');
    await press('Enviar denuncia');

    expect(report).not.toHaveBeenCalled();
  });

  it('Cancelar goes back without sending anything', async () => {
    const report = jest.spyOn(reportService, 'report');

    renderScreen();
    await press('Cancelar');

    expect(mockBack).toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });
});
