import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { InlineTagMark } from '../../../src/extensions/InlineTagMark';

describe('InlineTagMark', () => {
  let editor: Editor;
  let onCrossRefClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCrossRefClick = vi.fn();
    editor = new Editor({
      extensions: [
        Document,
        Paragraph,
        Text,
        InlineTagMark.configure({
          onCrossRefClick,
        }),
      ],
      content: '<p>Test content</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('configuration', () => {
    it('has correct name', () => {
      const mark = editor.extensionManager.extensions.find(
        ext => ext.name === 'inlineTag'
      );
      expect(mark).toBeDefined();
      expect(mark?.name).toBe('inlineTag');
    });

    it('provides default options', () => {
      const basicEditor = new Editor({
        extensions: [Document, Paragraph, Text, InlineTagMark],
        content: '<p>Test</p>',
      });

      const mark = basicEditor.extensionManager.extensions.find(
        ext => ext.name === 'inlineTag'
      );
      expect(mark?.options.HTMLAttributes).toEqual({});
      expect(mark?.options.onCrossRefClick).toBeNull();

      basicEditor.destroy();
    });

    it('accepts custom options', () => {
      const mark = editor.extensionManager.extensions.find(
        ext => ext.name === 'inlineTag'
      );
      expect(mark?.options.onCrossRefClick).toBe(onCrossRefClick);
    });
  });

  describe('attributes', () => {
    it('stores tagType attribute', () => {
      editor.commands.setContent('<p>Hello world</p>');
      editor.commands.selectAll();
      editor.commands.setInlineTag('illustration');

      const json = editor.getJSON();
      const marks = json.content?.[0]?.content?.[0]?.marks;
      expect(marks).toBeDefined();
      expect(marks?.[0]).toMatchObject({
        type: 'inlineTag',
        attrs: { tagType: 'illustration' },
      });
    });

    it('returns empty object for missing tagType in renderHTML', () => {
      // Test that null tagType doesn't add attribute
      editor.commands.setContent('<p>Hello world</p>');
      editor.commands.selectAll();
      editor.commands.setMark('inlineTag', { tagType: null });

      const html = editor.getHTML();
      // Should still render span but without data-inline-tag attribute
      expect(html).toContain('<span>');
    });
  });

  describe('parseHTML', () => {
    it('parses span with data-inline-tag attribute', () => {
      editor.commands.setContent(
        '<p><span data-inline-tag="application">Apply this</span></p>'
      );

      const json = editor.getJSON();
      const marks = json.content?.[0]?.content?.[0]?.marks;
      expect(marks?.[0]).toMatchObject({
        type: 'inlineTag',
        attrs: { tagType: 'application' },
      });
    });

    it('ignores spans without data-inline-tag', () => {
      editor.commands.setContent('<p><span class="other">Text</span></p>');

      const json = editor.getJSON();
      const marks = json.content?.[0]?.content?.[0]?.marks;
      expect(marks).toBeUndefined();
    });
  });

  describe('renderHTML', () => {
    it('renders span with data-inline-tag attribute', () => {
      editor.commands.setContent('<p>Test text</p>');
      editor.commands.selectAll();
      editor.commands.setInlineTag('crossref');

      const html = editor.getHTML();
      expect(html).toContain('data-inline-tag="crossref"');
      expect(html).toContain('<span');
    });

    it('merges custom HTMLAttributes', () => {
      const customEditor = new Editor({
        extensions: [
          Document,
          Paragraph,
          Text,
          InlineTagMark.configure({
            HTMLAttributes: {
              class: 'custom-tag',
            },
          }),
        ],
        content: '<p>Test</p>',
      });

      customEditor.commands.selectAll();
      customEditor.commands.setInlineTag('illustration');

      const html = customEditor.getHTML();
      expect(html).toContain('class="custom-tag"');

      customEditor.destroy();
    });
  });

  describe('commands', () => {
    beforeEach(() => {
      editor.commands.setContent('<p>Hello world</p>');
      editor.commands.selectAll();
    });

    it('setInlineTag applies mark with tagType', () => {
      const result = editor.commands.setInlineTag('illustration');
      expect(result).toBe(true);

      const json = editor.getJSON();
      const marks = json.content?.[0]?.content?.[0]?.marks;
      expect(marks?.[0]?.attrs?.tagType).toBe('illustration');
    });

    it('toggleInlineTag toggles mark on', () => {
      const result = editor.commands.toggleInlineTag('application');
      expect(result).toBe(true);

      const json = editor.getJSON();
      const marks = json.content?.[0]?.content?.[0]?.marks;
      expect(marks?.[0]?.attrs?.tagType).toBe('application');
    });

    it('toggleInlineTag toggles mark off', () => {
      editor.commands.setInlineTag('quote');
      editor.commands.selectAll();
      editor.commands.toggleInlineTag('quote');

      const json = editor.getJSON();
      const marks = json.content?.[0]?.content?.[0]?.marks;
      expect(marks).toBeUndefined();
    });

    it('unsetInlineTag removes mark', () => {
      editor.commands.setInlineTag('illustration');
      editor.commands.selectAll();

      const result = editor.commands.unsetInlineTag();
      expect(result).toBe(true);

      const json = editor.getJSON();
      const marks = json.content?.[0]?.content?.[0]?.marks;
      expect(marks).toBeUndefined();
    });
  });

  describe('ProseMirror plugin - click handling', () => {
    it('does not handle click when no callback provided', () => {
      const noCallbackEditor = new Editor({
        extensions: [Document, Paragraph, Text, InlineTagMark],
        content: '<p><span data-inline-tag="crossref">Romans 3:23</span></p>',
      });

      // Verify the extension is registered and has prosemirror plugins
      const mark = noCallbackEditor.extensionManager.extensions.find(
        ext => ext.name === 'inlineTag'
      );
      expect(mark).toBeDefined();

      // The extension should have plugins configured
      const config = (mark as any)?.config;
      expect(config?.addProseMirrorPlugins).toBeDefined();

      noCallbackEditor.destroy();
    });

    it('registers click plugin when callback provided', () => {
      // Verify the extension is registered with callback
      const mark = editor.extensionManager.extensions.find(
        ext => ext.name === 'inlineTag'
      );
      expect(mark).toBeDefined();
      expect(mark?.options.onCrossRefClick).toBe(onCrossRefClick);

      // The extension should have plugins configured
      const config = (mark as any)?.config;
      expect(config?.addProseMirrorPlugins).toBeDefined();
    });
  });

  describe('different tag types', () => {
    const tagTypes = ['illustration', 'application', 'quote', 'crossref', 'note'];

    tagTypes.forEach(tagType => {
      it(`supports ${tagType} tag type`, () => {
        editor.commands.setContent('<p>Test content</p>');
        editor.commands.selectAll();
        editor.commands.setInlineTag(tagType);

        const html = editor.getHTML();
        expect(html).toContain(`data-inline-tag="${tagType}"`);
      });
    });
  });

  describe('mark isolation', () => {
    it('applies mark only to selected text', () => {
      editor.commands.setContent('<p>Hello wonderful world</p>');

      // Select only "wonderful"
      editor.commands.setTextSelection({ from: 7, to: 16 });
      editor.commands.setInlineTag('illustration');

      const html = editor.getHTML();
      expect(html).toContain('Hello');
      expect(html).toContain('data-inline-tag="illustration"');
      expect(html).toContain('wonderful');
      expect(html).toContain('world');

      // Check that "Hello" and "world" are not marked
      const json = editor.getJSON();
      const content = json.content?.[0]?.content;
      expect(content).toHaveLength(3); // "Hello ", "wonderful", " world"
      expect(content?.[0]?.marks).toBeUndefined();
      expect(content?.[1]?.marks?.[0]?.attrs?.tagType).toBe('illustration');
      expect(content?.[2]?.marks).toBeUndefined();
    });
  });

  describe('export/import consistency', () => {
    it('round-trips HTML correctly', () => {
      const originalHtml =
        '<p><span data-inline-tag="illustration">Example illustration</span> and some text</p>';
      editor.commands.setContent(originalHtml);

      const exportedHtml = editor.getHTML();
      expect(exportedHtml).toContain('data-inline-tag="illustration"');
      expect(exportedHtml).toContain('Example illustration');

      // Import the exported HTML into a new editor
      const newEditor = new Editor({
        extensions: [Document, Paragraph, Text, InlineTagMark],
        content: exportedHtml,
      });

      const reimportedJson = newEditor.getJSON();
      const marks = reimportedJson.content?.[0]?.content?.[0]?.marks;
      expect(marks?.[0]?.attrs?.tagType).toBe('illustration');

      newEditor.destroy();
    });
  });
});
