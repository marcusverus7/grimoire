import { useRef, useCallback } from "react";
import { View, StyleSheet, Platform, KeyboardAvoidingView } from "react-native";
import {
  RichText,
  Toolbar,
  useEditorBridge,
  CoreBridge,
  BoldBridge,
  ItalicBridge,
  HeadingBridge,
  BulletListBridge,
  OrderedListBridge,
  BlockquoteBridge,
  ListItemBridge,
  HistoryBridge,
  PlaceholderBridge,
  HardBreakBridge,
  DropCursorBridge,
} from "@10play/tentap-editor";
import type { EditorBridge } from "@10play/tentap-editor";
import type { RichTextNode } from "@grimoire/core";

const GRIMOIRE_BRIDGES = [
  CoreBridge,
  BoldBridge,
  ItalicBridge,
  HeadingBridge,
  BulletListBridge,
  OrderedListBridge,
  BlockquoteBridge,
  ListItemBridge,
  HistoryBridge,
  HardBreakBridge,
  DropCursorBridge,
  PlaceholderBridge.configureExtension({ placeholder: "Begin writing…" }),
];

const EDITOR_CSS = `
  * { box-sizing: border-box; }
  body {
    background-color: #1A1410;
    color: #ECE3CF;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 16px;
    line-height: 1.6;
    padding: 12px 16px;
    margin: 0;
    caret-color: #A07A2C;
  }
  .ProseMirror {
    outline: none;
    min-height: 120px;
  }
  .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: #ECE3CF40;
    font-style: italic;
    pointer-events: none;
    float: left;
    height: 0;
  }
  h1, h2, h3 {
    color: #F5EFDE;
    font-weight: 700;
    margin-top: 1em;
    margin-bottom: 0.3em;
  }
  h1 { font-size: 1.5em; }
  h2 { font-size: 1.25em; }
  h3 { font-size: 1.1em; }
  p { margin: 0 0 0.5em 0; }
  blockquote {
    border-left: 3px solid #A07A2C;
    padding-left: 12px;
    margin-left: 0;
    color: #E0D4BC;
    font-style: italic;
  }
  ul, ol {
    padding-left: 20px;
    margin: 0 0 0.5em 0;
  }
  li { margin-bottom: 0.2em; }
  strong { color: #F5EFDE; }
  em { color: #E0D4BC; }
  ::selection {
    background-color: #A07A2C40;
  }
`;

interface RichTextEditorProps {
  initialContent?: RichTextNode | null;
  editorRef?: React.MutableRefObject<EditorBridge | null>;
  minHeight?: number;
}

export default function RichTextEditor({
  initialContent,
  editorRef,
  minHeight = 200,
}: RichTextEditorProps) {
  const editor = useEditorBridge({
    bridgeExtensions: GRIMOIRE_BRIDGES,
    initialContent: initialContent ?? undefined,
    autofocus: false,
    theme: {
      toolbar: {
        toolbarBody: {
          backgroundColor: "#1A1410",
          borderTopWidth: 0.8,
          borderTopColor: "#A07A2C50",
        },
        toolbarButton: {},
        icon: { tintColor: "#ECE3CF80" },
        iconActive: { tintColor: "#A07A2C" },
        iconDisabled: { tintColor: "#ECE3CF20" },
        iconWrapper: {},
        iconWrapperActive: { backgroundColor: "#A07A2C15" },
        iconWrapperDisabled: {},
        hidden: { display: "none" },
        keyboardAvoidingView: {},
        linkBarTheme: {
          addLinkContainer: { backgroundColor: "#1A1410" },
          linkInput: { color: "#ECE3CF", borderColor: "#A07A2C50" },
          placeholderTextColor: "#ECE3CF40",
          doneButton: { backgroundColor: "#A07A2C" },
          doneButtonText: { color: "#ECE3CF" },
          linkToolbarButton: {},
        },
      },
      webview: {},
      webviewContainer: {},
    },
  });

  if (editorRef) {
    editorRef.current = editor;
  }

  const injectTheme = useCallback(() => {
    editor.injectCSS(EDITOR_CSS, "grimoire-theme");
  }, [editor]);

  return (
    <View style={[styles.container, { minHeight }]}>
      <RichText
        editor={editor}
        style={styles.webview}
        onLoad={injectTheme}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.toolbarWrapper}
      >
        <Toolbar editor={editor} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: "#A07A2C30",
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#1A1410",
  },
  webview: {
    flex: 1,
    backgroundColor: "#1A1410",
  },
  toolbarWrapper: {},
});

export type { RichTextEditorProps };
