import { useColorScheme } from "react-native";

import colors from "@/constants/colors";

type Palette = typeof colors.light;

/**
 * Returns the design tokens for the current color scheme.
 *
 * Falls back to the light palette when the device reports no preference.
 * Both light and dark palettes are defined in constants/colors.ts.
 */
export function useColors(): Palette & { radius: number } {
  const scheme = useColorScheme();
  const palette: Palette = scheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
