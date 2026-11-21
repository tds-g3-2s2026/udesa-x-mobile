import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View as Box,
} from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';
import { FeedItem } from '../../../types/post';
import { authorName, visible } from '../assistantView';
import { AssistantState } from '../useAssistant';
import { Confirmation, Proposal } from '../voiceExecutor';

interface AssistantPanelProps {
  state: AssistantState;
  onConfirm: (confirmation: Confirmation) => void;
  onCancel: () => void;
  onClose: () => void;
}

// Everything the assistant does happens here, in front of the user: what it
// understood, what it is doing, what it looks at and what it needs confirmed.
export function AssistantPanel({ state, onConfirm, onCancel, onClose }: AssistantPanelProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const busy = state.phase === 'working' || state.phase === 'confirming';

  return (
    <Modal
      visible={state.phase !== 'idle'}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Box style={styles.backdrop}>
        <Box style={styles.sheet}>
          <Box style={styles.header}>
            <Text style={styles.title}>Asistente</Text>
            <TouchableOpacity
              onPress={busy ? onCancel : onClose}
              accessibilityRole="button"
              accessibilityLabel={busy ? 'Cortar el pedido' : 'Cerrar el asistente'}
            >
              <Text style={styles.headerAction}>{busy ? 'Cortar' : 'Cerrar'}</Text>
            </TouchableOpacity>
          </Box>

          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.heard} testID="assistant-heard">
              Entendí: “{state.heard}”
            </Text>

            {state.doing ? (
              <Box style={styles.doing}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.doingText}>{state.doing}</Text>
              </Box>
            ) : null}

            {state.proposal ? (
              <ConfirmCard proposal={state.proposal} onConfirm={onConfirm} styles={styles} />
            ) : null}

            {state.said ? (
              <Text
                style={[styles.said, state.phase === 'failed' && styles.failed]}
                testID="assistant-said"
              >
                {state.said}
              </Text>
            ) : null}

            {state.snapshot ? <OnScreen snapshot={state.snapshot} styles={styles} /> : null}
          </ScrollView>
        </Box>
      </Box>
    </Modal>
  );
}

const CONFIRM_TITLES: Record<string, string> = {
  retweet_post: '¿Retuiteo este post?',
  reply_to_post: '¿Respondo esto?',
  compose_post: '¿Publico esto?',
  follow: '¿Sigo a esta cuenta?',
};

function ConfirmCard({
  proposal,
  onConfirm,
  styles,
}: {
  proposal: Proposal;
  onConfirm: (confirmation: Confirmation) => void;
  styles: Styles;
}) {
  const [text, setText] = useState(proposal.text ?? '');
  useEffect(() => setText(proposal.text ?? ''), [proposal]);
  const editable = proposal.text !== undefined;

  return (
    <Box style={styles.card} testID="assistant-confirm">
      <Text style={styles.cardTitle}>{CONFIRM_TITLES[proposal.action] ?? '¿Lo hago?'}</Text>
      {proposal.post ? <PostLine post={proposal.post} styles={styles} /> : null}
      {proposal.account ? (
        <Text style={styles.line}>
          {proposal.account.name} {proposal.account.handle}
        </Text>
      ) : null}
      {editable ? (
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={280}
          accessibilityLabel="Texto a publicar"
        />
      ) : null}
      <Box style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.secondary]}
          onPress={() => onConfirm({ confirmed: false })}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.primary]}
          onPress={() => onConfirm(editable ? { confirmed: true, text } : { confirmed: true })}
          disabled={editable && text.trim().length === 0}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Confirmar</Text>
        </TouchableOpacity>
      </Box>
    </Box>
  );
}

function OnScreen({
  snapshot,
  styles,
}: {
  snapshot: NonNullable<AssistantState['snapshot']>;
  styles: Styles;
}) {
  const { view, highlightedId } = snapshot;
  const { posts, accounts } = visible(view);
  return (
    <Box style={styles.screen}>
      <Text style={styles.screenTitle}>{SCREEN_TITLES[view.kind]}</Text>
      {view.kind === 'settings' ? (
        <Text style={styles.line}>
          Tema {view.preferences.theme === 'dark' ? 'oscuro' : 'claro'} · Idioma del feed:{' '}
          {view.preferences.feedLanguage}
        </Text>
      ) : null}
      {accounts.map((account) => (
        <Text
          key={account.id}
          style={[styles.line, account.id === highlightedId && styles.highlighted]}
        >
          {account.name} {account.handle}
          {account.following ? ' · La seguís' : ''}
        </Text>
      ))}
      {posts.map((post) => (
        <PostLine
          key={post.id}
          post={post}
          styles={styles}
          highlighted={post.id === highlightedId}
        />
      ))}
    </Box>
  );
}

const SCREEN_TITLES: Record<string, string> = {
  feed: 'En el feed',
  post: 'El post',
  search: 'Resultados',
  profile: 'El perfil',
  settings: 'Preferencias',
};

function PostLine({
  post,
  styles,
  highlighted = false,
}: {
  post: FeedItem;
  styles: Styles;
  highlighted?: boolean;
}) {
  const marks = `${post.likedByMe ? ' ♥' : ''}${post.retweetedByMe ? ' ↻' : ''}`;
  return (
    <Box
      style={[styles.post, highlighted && styles.highlighted]}
      testID={highlighted ? 'assistant-highlighted' : undefined}
    >
      <Text style={styles.postAuthor}>
        {authorName(post)}
        {marks}
      </Text>
      <Text style={styles.line} numberOfLines={2}>
        {post.content ?? ''}
      </Text>
    </Box>
  );
}

type Styles = ReturnType<typeof createStyles>;

function createStyles(colors: Colors) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      maxHeight: '85%',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      backgroundColor: colors.surface,
      paddingBottom: 24,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    headerAction: { fontSize: 15, fontWeight: '600', color: colors.primary, padding: 8 },
    body: { padding: 16, gap: 12 },
    heard: { fontSize: 16, color: colors.text },
    doing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    doingText: { fontSize: 15, color: colors.muted },
    said: { fontSize: 16, fontWeight: '600', color: colors.text },
    failed: { color: colors.danger },
    card: {
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    input: {
      minHeight: 60,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.field,
      color: colors.text,
      fontSize: 15,
    },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    button: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center' },
    primary: { backgroundColor: colors.primaryFill },
    primaryText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
    secondary: { borderWidth: 1, borderColor: colors.border },
    secondaryText: { color: colors.text, fontWeight: '600', fontSize: 15 },
    screen: { gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.divider },
    screenTitle: { fontSize: 13, fontWeight: '700', color: colors.muted },
    post: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.divider },
    postAuthor: { fontSize: 14, fontWeight: '700', color: colors.text },
    line: { fontSize: 14, color: colors.text },
    highlighted: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  });
}
