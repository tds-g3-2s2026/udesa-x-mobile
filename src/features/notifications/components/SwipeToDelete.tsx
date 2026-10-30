import { ReactNode, useEffect, useMemo, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Dimensions, PanResponder, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';

// How far left, in points, a drag has to end for the row to be deleted.
const DELETE_DISTANCE = 120;
// A quick flick deletes even when it ends short of that distance (points per ms).
const DELETE_VELOCITY = 0.8;
// A drag only becomes a swipe once it has moved this far, so a tap still opens the row.
const SWIPE_START = 10;

interface SwipeToDeleteProps {
  children: ReactNode;
  onDelete: () => void;
  testID?: string;
}

// Dragging the row to the left uncovers a red band with a trash icon, and
// releasing it far or fast enough slides the row out and deletes it. Built on
// React Native's own PanResponder and Animated, so it adds no library. The
// trash button inside the row stays as the accessible way to delete, since a
// screen reader cannot swipe.
export function SwipeToDelete({ children, onDelete, testID }: SwipeToDeleteProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateX = useRef(new Animated.Value(0)).current;

  // The responder is created once, so it reads the latest onDelete through a
  // ref instead of keeping the one from the first render.
  const onDeleteRef = useRef(onDelete);
  useEffect(() => {
    onDeleteRef.current = onDelete;
  }, [onDelete]);

  const responder = useRef(
    PanResponder.create({
      // Only a mostly horizontal drag to the left is a swipe. A vertical one
      // stays with the list, which keeps scrolling.
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dx < -SWIPE_START && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderMove: (_, gesture) => translateX.setValue(Math.min(0, gesture.dx)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -DELETE_DISTANCE || gesture.vx < -DELETE_VELOCITY) {
          Animated.timing(translateX, {
            toValue: -Dimensions.get('window').width,
            duration: 150,
            useNativeDriver: true,
          }).start(() => onDeleteRef.current());
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      // Once the row is being dragged, the list cannot take the gesture back
      // halfway. If the system cancels it anyway, the row goes back in place.
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () =>
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(),
    })
  ).current;

  return (
    <View style={styles.container}>
      <View
        style={styles.behind}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons name="trash-outline" size={20} color={colors.onPrimary} />
      </View>
      <Animated.View
        testID={testID}
        style={{ transform: [{ translateX }] }}
        {...responder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: {
      overflow: 'hidden',
    },
    behind: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.danger,
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingRight: 24,
    },
  });
}
