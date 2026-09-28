import * as React from 'react';
import { Animated, Easing, PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DELETE_WIDTH = 72;
const ACTIVATE_DISTANCE = 4;
const SNAP_DURATION = 200;
const SNAP_EASING = Easing.out(Easing.cubic);

// Swipe-left-to-delete, the pattern most list apps (Mail, Reminders, etc.)
// use instead of a permanent trash icon on every row. Built on RN's core
// PanResponder + Animated (no gesture-handler/reanimated dependency) since
// this workspace doesn't otherwise need those libraries.
export function SwipeableRow({
  children,
  onDelete,
  destructiveColor = '#ef4343',
  disabled = false,
  borderRadius = 0,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  destructiveColor?: string;
  disabled?: boolean;
  // Must match the wrapped row's own borderRadius, otherwise the red delete
  // background — a plain rectangle — peeks out past the row's rounded
  // corners.
  borderRadius?: number;
}) {
  const translateX = React.useRef(new Animated.Value(0)).current;
  const openRef = React.useRef(false);
  const disabledRef = React.useRef(disabled);
  disabledRef.current = disabled;

  // A plain deceleration curve (rather than a spring) snaps into place
  // decisively instead of settling with a slight wobble/creep, which is
  // what read as "sloppy".
  function close() {
    openRef.current = false;
    Animated.timing(translateX, { toValue: 0, duration: SNAP_DURATION, easing: SNAP_EASING, useNativeDriver: true }).start();
  }

  function open() {
    openRef.current = true;
    Animated.timing(translateX, { toValue: -DELETE_WIDTH, duration: SNAP_DURATION, easing: SNAP_EASING, useNativeDriver: true }).start();
  }

  const panResponder = React.useRef(
    PanResponder.create({
      // A low distance + a plain "more horizontal than vertical" ratio
      // (rather than requiring a strongly horizontal gesture) so this wins
      // the gesture negotiation against the surrounding ScrollView/FlatList
      // more readily — real swipes are rarely perfectly horizontal, and a
      // stricter ratio just meant most attempts scrolled the list instead.
      onMoveShouldSetPanResponder: (_, gesture) =>
        !disabledRef.current && Math.abs(gesture.dx) > ACTIVATE_DISTANCE && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        const base = openRef.current ? -DELETE_WIDTH : 0;
        const next = Math.max(-DELETE_WIDTH, Math.min(0, base + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const base = openRef.current ? -DELETE_WIDTH : 0;
        const projected = base + gesture.dx;
        if (projected < -DELETE_WIDTH / 2) open();
        else close();
      },
      onPanResponderTerminate: close,
      // Once we've won the gesture (which already required a horizontal
      // bias to happen at all) don't let the parent scroll view yank it
      // back mid-swipe — that's what produced the "moves up/down by
      // mistake" jump.
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  return (
    <View style={[styles.container, { borderRadius }]}>
      <View
        style={[
          styles.deleteBackground,
          {
            backgroundColor: destructiveColor,
            width: DELETE_WIDTH,
            borderTopRightRadius: borderRadius,
            borderBottomRightRadius: borderRadius,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => { close(); onDelete(); }}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <Animated.View
        style={{ transform: [{ translateX }], borderRadius }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  deleteBackground: {
    position: 'absolute', top: 0, bottom: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteButton: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
});
