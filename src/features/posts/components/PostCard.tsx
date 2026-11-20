import { useContext, useMemo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';
import { touchTarget } from '../../../theme/touchTarget';
import { FeedItem } from '../../../types/post';
import { formatRelativeTime } from '../relativeTime';
import { splitPostText } from '../postText';
import { useAuthStore } from '../../../stores/authStore';
import { CurrentProfileContext } from '../currentProfile';
import { Avatar } from '../../social/components/Avatar';
import { DeletePostButton } from './DeletePostButton';
import { BookmarkButton } from './BookmarkButton';
import { LikeButton } from './LikeButton';
import { PostImageGrid } from './PostImageGrid';
import { QuotedPost } from './QuotedPost';
import { RetweetButton } from './RetweetButton';
import { DELETED_AUTHOR_LABEL } from '../labels';

export { DELETED_AUTHOR_LABEL };

interface PostCardProps {
  item: FeedItem;
  onDelete?: () => void;
  deletePending?: boolean;
  onLike?: () => void;
  likePending?: boolean;
  onRetweet?: () => void;
  retweetPending?: boolean;
  onBookmark?: () => void;
  bookmarkPending?: boolean;
  // Reporting yourself is refused by posts-api, so a screen passes this only
  // for someone else's post: the button could only ever lead to an error.
  onReport?: () => void;
  onReply?: () => void;
  // Without it the card still shows how many times the post was quoted.
  onQuote?: () => void;
  // The detail screen shows its own post and has nowhere further to open.
  onOpen?: () => void;
}

export function PostCard({
  item,
  onLike,
  likePending = false,
  onDelete,
  deletePending = false,
  onReport,
  onReply,
  onQuote,
  onOpen,
  onRetweet,
  retweetPending = false,
  onBookmark,
  bookmarkPending = false,
}: PostCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id);
  const currentProfileId = useContext(CurrentProfileContext);
  // Your own posts link nowhere, your profile is a tab of its own. Neither does
  // a card shown on its author's profile, which is the screen already open.
  // A deleted account has no profile left: opening it would only land on a 404.
  const canOpenAuthor =
    !item.authorDeleted && item.authorId !== userId && item.authorId !== currentProfileId;

  const card = (
    <>
      {item.retweetedBy ? (
        <Text style={styles.counterLabel}>Retweeteado por {item.retweetedBy}</Text>
      ) : null}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.authorLink}
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.authorId } })}
          disabled={!canOpenAuthor}
          accessibilityRole={canOpenAuthor ? 'link' : undefined}
          accessibilityLabel={
            canOpenAuthor ? `Ver el perfil de ${item.authorHandle ?? 'esta cuenta'}` : undefined
          }
        >
          <Avatar url={item.authorAvatarUrl} size={40} />
          <View style={styles.authorBlock}>
            <Text style={styles.author}>
              {item.authorDeleted
                ? DELETED_AUTHOR_LABEL
                : item.authorDisplayName || item.authorHandle}
            </Text>
            {!item.authorDeleted && item.authorDisplayName && item.authorHandle ? (
              <Text style={styles.handle}>{item.authorHandle}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
        <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
        {onDelete && !item.deleted ? (
          <DeletePostButton onConfirm={onDelete} disabled={deletePending || retweetPending} />
        ) : null}
        {onReport && !item.deleted && !deletePending ? (
          <TouchableOpacity
            style={styles.reportButton}
            onPress={onReport}
            accessibilityRole="button"
            accessibilityLabel={`Denunciar post de ${item.authorHandle ?? 'esta cuenta'}`}
          >
            <Ionicons name="flag-outline" size={16} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.content}>
        {item.deleted
          ? '[Post eliminado]'
          : splitPostText(item.content ?? '', item.mentions).map((part, index) => {
              const { mention } = part;
              if (part.hashtag) {
                return (
                  <Text
                    key={index}
                    style={styles.link}
                    accessibilityRole="link"
                    onPress={() => router.push({ pathname: '/search', params: { q: part.text } })}
                  >
                    {part.text}
                  </Text>
                );
              }
              if (mention) {
                return (
                  <Text
                    key={index}
                    style={styles.link}
                    accessibilityRole="link"
                    onPress={() =>
                      router.push({ pathname: '/user/[id]', params: { id: mention.id } })
                    }
                  >
                    {part.text}
                  </Text>
                );
              }
              return part.text;
            })}
      </Text>

      {!item.deleted ? <PostImageGrid images={item.images} /> : null}

      {!item.deleted && item.quotedPostId ? <QuotedPost postId={item.quotedPostId} /> : null}

      {!item.deleted && !deletePending ? (
        <View style={styles.counters}>
          {onLike ? (
            <LikeButton
              liked={item.likedByMe}
              count={item.likesCount}
              onPress={onLike}
              pending={likePending}
            />
          ) : (
            <View style={styles.counter}>
              <Ionicons name="heart-outline" size={16} color={colors.muted} />
              <Text style={styles.counterLabel}>{item.likesCount}</Text>
            </View>
          )}
          {onBookmark ? (
            <BookmarkButton saved={item.savedByMe} pending={bookmarkPending} onPress={onBookmark} />
          ) : null}
          {onRetweet ? (
            <RetweetButton
              retweeted={item.retweetedByMe}
              count={item.retweetsCount}
              pending={retweetPending}
              onPress={onRetweet}
            />
          ) : (
            <View style={styles.counter}>
              <Ionicons name="repeat-outline" size={16} color={colors.muted} />
              <Text style={styles.counterLabel}>{item.retweetsCount}</Text>
            </View>
          )}
          {onQuote ? (
            <TouchableOpacity
              style={styles.replyButton}
              onPress={onQuote}
              accessibilityRole="button"
              accessibilityLabel={`Citar el post de ${item.authorHandle ?? 'esta cuenta'}`}
            >
              <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.primary} />
              <Text style={styles.counterLabel}>{item.quotesCount ?? 0}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.counter} testID="quotes-count">
              <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.muted} />
              <Text style={styles.counterLabel}>{item.quotesCount ?? 0}</Text>
            </View>
          )}
          {onReply ? (
            <TouchableOpacity
              style={styles.replyButton}
              onPress={onReply}
              accessibilityRole="button"
              accessibilityLabel={`Responder a ${item.authorHandle ?? 'esta cuenta'}`}
            >
              <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
              <Text style={styles.counterLabel}>{item.repliesCount}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.counter}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.muted} />
              <Text style={styles.counterLabel}>{item.repliesCount}</Text>
            </View>
          )}
        </View>
      ) : null}
    </>
  );

  if (!onOpen) return <View style={styles.card}>{card}</View>;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Abrir la publicación de ${item.authorHandle ?? 'esta cuenta'}`}
    >
      {card}
    </TouchableOpacity>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.field,
      marginBottom: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    authorLink: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    authorBlock: {
      flex: 1,
    },
    author: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    handle: {
      fontSize: 12,
      color: colors.muted,
    },
    time: {
      fontSize: 12,
      color: colors.muted,
    },
    reportButton: touchTarget,
    content: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 21,
      marginBottom: 10,
    },
    link: {
      color: colors.primary,
      fontWeight: '600',
    },
    // The buttons are 44 tall but their icons only 16: the negative margin
    // lets the extra box sit over the space around the row, so the card
    // keeps its height and every press still lands inside it.
    counters: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      marginVertical: -8,
    },
    counter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    replyButton: {
      ...touchTarget,
      flexDirection: 'row',
      gap: 4,
    },
    counterLabel: {
      fontSize: 13,
      color: colors.muted,
    },
  });
}
