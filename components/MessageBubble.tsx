import { Image, StyleSheet, Text, View } from "react-native";
import { usePhotoUri } from "@/hooks/usePhotoUri";
import { colors, radius, spacing } from "@/lib/theme";
import type { ChatMessage } from "@/lib/types";

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const resolvedImage = usePhotoUri(message.imageUri);
  const isUser = message.role === "user";
  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {resolvedImage && (
          <Image
            source={{ uri: resolvedImage }}
            style={styles.image}
            resizeMode="cover"
          />
        )}
        {message.text.length > 0 && (
          <Text
            style={[
              styles.text,
              isUser ? styles.textUser : styles.textAssistant,
              resolvedImage ? styles.textWithImage : null,
            ]}
          >
            {message.text}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  rowLeft: {
    justifyContent: "flex-start",
  },
  rowRight: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "85%",
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bubbleUser: {
    backgroundColor: colors.brand,
    borderBottomRightRadius: 6,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  image: {
    width: 220,
    height: 220,
    borderRadius: radius.md,
    backgroundColor: "#f5f5f4",
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  textUser: {
    color: "#ffffff",
  },
  textAssistant: {
    color: colors.text,
  },
  textWithImage: {
    marginTop: spacing.sm,
  },
});
