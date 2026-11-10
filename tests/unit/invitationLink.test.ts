import { buildInvitationLink } from '../../src/features/invitations/invitationLink';

// Outside a build the manifest that holds the app scheme is missing, so the
// link is built the way a device with the scheme would build it.
jest.mock('expo-linking', () => ({
  createURL: (path: string, options?: { queryParams?: Record<string, string> }) =>
    `udesax://${path}?${new URLSearchParams(options?.queryParams).toString()}`,
}));

describe('E3-H9. Invitar Usuarios Externos', () => {
  it('E3-H9.CA1 - the link opens the registration and carries the account id as ref', () => {
    const link = buildInvitationLink('7a1d3c9b-2e4f-4a6b-8d0c-1f3e5a7b9c2d');

    expect(link).toContain('register');
    expect(link).toContain('ref=7a1d3c9b-2e4f-4a6b-8d0c-1f3e5a7b9c2d');
  });

  it('E3-H9.CA3 - an account has a single link, always the same', () => {
    expect(buildInvitationLink('usr-ana')).toBe(buildInvitationLink('usr-ana'));
  });

  it('E3-H9.CA1 - two accounts never share a link', () => {
    expect(buildInvitationLink('usr-ana')).not.toBe(buildInvitationLink('usr-beto'));
  });
});
