import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type SmoothPressableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
};

export function SmoothPressable({ disabled, onPressIn, onPressOut, style, ...props }: SmoothPressableProps) {
  const [motion] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (active) setReduceMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  const animate = (toValue: number, duration: number) => {
    if (reduceMotion || disabled) {
      motion.setValue(1);
      return;
    }
    Animated.timing(motion, {
      toValue,
      duration,
      easing: toValue < 1 ? Easing.out(Easing.quad) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  return <AnimatedPressable
    {...props}
    disabled={disabled}
    onPressIn={(event) => { animate(0.965, 85); onPressIn?.(event); }}
    onPressOut={(event) => { animate(1, 150); onPressOut?.(event); }}
    style={[style, { transform: [{ scale: motion }] }]}
  />;
}
