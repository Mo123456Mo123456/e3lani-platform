import { Platform, Share } from "react-native";

type WebNavigator = Navigator & {
  share?: (data: {
    title?: string;
    text?: string;
    url?: string;
  }) => Promise<void>;
};

export async function shareText(message: string, title?: string) {
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    const webNavigator = navigator as WebNavigator;
    if (webNavigator.share) {
      try {
        await webNavigator.share({ title, text: message });
        return true;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return true;
      }
    }

    try {
      await webNavigator.clipboard?.writeText(message);
      return Boolean(webNavigator.clipboard);
    } catch {
      return false;
    }
  }

  try {
    await Share.share({ message, title });
    return true;
  } catch {
    return false;
  }
}
