import { useMemo, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { useAuthStyles } from '../../src/features/auth/components/authTheme';
import { useThemeColors } from '../../src/theme/useThemeColors';
import { Colors } from '../../src/theme/colors';

type IconName = keyof typeof Ionicons.glyphMap;

const SLIDES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'chatbubbles-outline',
    title: 'Publicá lo que pasa',
    text: 'Escribí posts, sumá imágenes y respondé lo que publican los demás.',
  },
  {
    icon: 'people-outline',
    title: 'Seguí a quien te interesa',
    text: 'Tu inicio muestra lo que publican las cuentas que seguís.',
  },
  {
    icon: 'notifications-outline',
    title: 'Enterate de todo',
    text: 'Te avisamos cuando te siguen, te responden o les gusta lo que publicaste.',
  },
];

// The first step of the onboarding: what the app does, one swipeable page per
// feature. "Saltear" and the last page both lead to the interests, which
// cannot be skipped.
export default function WelcomeScreen() {
  const router = useRouter();
  const authStyles = useAuthStyles();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pager = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [page, setPage] = useState(0);
  const isLast = page === SLIDES.length - 1;

  const goTo = (next: number) => {
    setPage(next);
    pager.current?.scrollTo({ x: next * pageWidth, animated: true });
  };

  // A swipe moves the pager on its own: the dots and the button follow it.
  const handleSwipe = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth > 0) setPage(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  };

  return (
    <AuthScreen
      header={<Text style={authStyles.title}>Bienvenido a UdeSA-X</Text>}
      submitLabel={isLast ? 'Empezar' : 'Siguiente'}
      onSubmit={() => (isLast ? router.push('/interests') : goTo(page + 1))}
      footer={
        isLast ? null : (
          <Text style={authStyles.footerLink} onPress={() => router.push('/interests')}>
            Saltear
          </Text>
        )
      }
    >
      <View>
        <ScrollView
          ref={pager}
          testID="onboarding-carousel"
          onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleSwipe}
        >
          {SLIDES.map((slide) => (
            <View key={slide.title} style={[styles.slide, { width: pageWidth }]}>
              <Ionicons name={slide.icon} size={56} color={colors.primary} />
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideText}>{slide.text}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.dots}>
          {SLIDES.map((slide, index) => (
            <View key={slide.title} style={[styles.dot, index === page && styles.activeDot]} />
          ))}
        </View>
      </View>
    </AuthScreen>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    slide: {
      alignItems: 'center',
      gap: 12,
      paddingVertical: 24,
      paddingHorizontal: 8,
    },
    slideTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    slideText: {
      fontSize: 15,
      lineHeight: 21,
      color: colors.muted,
      textAlign: 'center',
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    activeDot: {
      backgroundColor: colors.primary,
    },
  });
}
