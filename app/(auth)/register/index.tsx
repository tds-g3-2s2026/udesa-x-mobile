import React, { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { RegisterStep } from '../../../src/features/auth/components/RegisterStep';
import { useRegisterDraft } from '../../../src/stores/registerDraftStore';

export default function RegisterEmailScreen() {
  // An invitation link opens the wizard with the inviter's id as `ref`.
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const setReferrer = useRegisterDraft((state) => state.setReferrer);

  useEffect(() => {
    if (typeof ref === 'string' && ref.length > 0) setReferrer(ref);
  }, [ref, setReferrer]);

  return <RegisterStep field="email" />;
}
