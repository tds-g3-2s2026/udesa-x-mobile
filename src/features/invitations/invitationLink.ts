import * as Linking from 'expo-linking';

// The link opens the registration with the inviter's id as `ref`. It is built
// on the device from the signed-in account: it is always the same for one
// account, and users-api ignores a `ref` that does not lead to an active one.
export function buildInvitationLink(userId: string): string {
  return Linking.createURL('register', { queryParams: { ref: userId } });
}
