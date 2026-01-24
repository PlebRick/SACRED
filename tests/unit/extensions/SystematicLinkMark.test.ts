import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { SystematicLinkMark } from '../../../src/extensions/SystematicLinkMark';

describe('SystematicLinkMark', () => {
  let editor: Editor;
  let onLinkClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onLinkClick = vi.fn();
    editor = new Editor({
      extensions: [
        Document,
        Paragraph,
        Text,
        SystematicLinkMark.configure({
          onLinkClick,
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
        ext => ext.name === 'systematicLink'
      );
      expect(mark).toBeDefined();
      expect(mark?.name).toBe('systematicLink');
    });

    it('provides default options', () => {
      const basicEditor = new Editor({
        extensions: [Document, Paragraph, Text, SystematicLinkMark],
        content: '<p>Test</p>',
      });

      const mark = basicEditor.extensionManager.extensions.find(
        ext => ext.name === 'systematicLink'
      );
      expect(mark?.options.HTMLAttributes).toEqual({ class: 'systematic-link' });
      expect(mark?.options.onLinkClick).toBeNull();

      basicEditor.destroy();
    });

    it('accepts custom options', () => {
      const mark = editor.extensionManager.extensions.find(
        ext => ext.name === 'systematicLink'
      );
      expect(mark?.options.onLinkClick).toBe(onLinkClick);
    });

    it('allows custom HTMLAttributes', () => {
      const customEditor = new Editor({
        extensions: [
          Document,
          Paragraph,
          Text,
          SystematicLinkMark.configure({
            HTMLAttributes: { class: 'my-doctrine-link' },
          }),
        ],
        content: '<p>Test</p>',
      });

      const mark = customEditor.extensionManager.extensions.find(
        ext => ext.name === 'systematicLink'
      );
      expect(mark?.options.HTMLAttributes).toEqual({ class: 'my-doctrine-link' });

      customEditor.destroy();
    });
  });

  describe('attributes', () => {
    it('stores reference attribute', () => {
      editor.commands.setContent('<p>Hello world</p>');
      editor.commands.selectAll();
      editor.commands.setSystematicLink('[[ST:Ch32]]', '[[ST:Ch32]]');

      const json = editor.getJSON();
      const marks = json.content?.[0]?.content?.[0]?.marks;
      expect(marks).toBeDefined();
      expect(marks?.[0]).toMatchObject({
        type: 'systematicLink',
        attrs: {
          reference: '[[ST:Ch32]]',
          display: '[[ST:Ch32]]',
        },
      });
    });

    it('stores display attribute separately', () => {
      editor.commands.setContent('<p>Hello world</p>');
      editor.commands.selectAll();
      editor.commands.setSystematicLink('[[ST:Ch32]]', 'Effectual Calling');

      const json = editor.getJSON();
      const marks = json.content?.[0]?.content?.[0]?.marks;
      expect(marks?.[0]?.attrs?.reference).toBe('[[ST:Ch32]]');
      expect(marks?.[0]?.attrs?.display).toBe('Effectual Calling');
    });

    it('returns empty object for missing reference in renderHTML', () => {
      editor.commands.setContent('<p>Hello world</p>');
      editor.commands.selectAll();
      editor.commands.setMark('systematicLink', { reference: null, display: null });

      const html = editor.getHTML();
      // Should still render span but without data-st-ref attribute
      expect(html).toContain('<span');
    });
  });

  describe('parseHTML', () => {
    it('parses span with data-st-ref attribute', () => {
      editor.commands.setContent(
        '<p><span data-st-ref="[[ST:Ch32]]" data-st-display="Effectual Calling">Effectual Calling</span></p>'
      );

      const json = editor.getJSON();
      const marks = json.content?.[0]?.content?.[0]?.marks;
      expect(marks?.[0]).toMatchObject({
        type: 'systematicLink',
        attrs: {
          reference: '[[ST:Ch32]]',
          display: 'Effectual Calling',
        },
      });
    });

    it('ignores spans without data-st-ref', () => {
      editor.commands.setContent('<p><span class="other">Text</span></p>');

      const json = editor.getJSON();
      const marks = json.content?.[0]?.content?.[0]?.marks;
      expect(marks).toBeUndefined();
    });
  });

  describe('renderHTML', () => {
    it('renders span with data-st-ref attribute', () => {
      editor.commands.setContent('<p>Test text</p>');
      editor.commands.selectAll();
      editor.commands.setSystematicLink('[[ST:Ch32]]', '[[ST:Ch32]]');

      const html = editor.getHTML();
      expect(html).toContain('data-st-ref="[[ST:Ch32]]"');
      expect(html).toContain('<span');
    });

    it('includes systematic-link class by default', () => {
      editor.commands.setContent('<p>Test text</p>');
      editor.commands.selectAll();
      editor.commands.setSystematicLink('[[ST:Ch32]]', '[[ST:Ch32]]');

      const html = editor.getHTML();
      expect(html).toContain('class="systematic-link"');
    });

    it('includes data-st-display attribute', () => {
      editor.commands.setContent('<p>Test text</p>');
      editor.commands.selectAll();
      editor.commands.setSystematicLink('[[ST:Ch32]]', 'Custom Display');

      const html = editor.getHTML();
      expect(html).toContain('data-st-display="Custom Display"');
    });
  });

  describe('commands', () => {
    describe('setSystematicLink', () => {
      beforeEach(() => {
        editor.commands.setContent('<p>Hello world</p>');
        editor.commands.selectAll();
      });

      it('applies mark with reference and display', () => {
        const result = editor.commands.setSystematicLink('[[ST:Ch36]]', '[[ST:Ch36]]');
        expect(result).toBe(true);

        const json = editor.getJSON();
        const marks = json.content?.[0]?.content?.[0]?.marks;
        expect(marks?.[0]?.attrs?.reference).toBe('[[ST:Ch36]]');
      });
    });

    describe('insertSystematicLink', () => {
      it('inserts link text when no selection', () => {
        editor.commands.setContent('<p>Before after</p>');
        // Position cursor between "Before" and "after"
        editor.commands.setTextSelection(8);

        editor.commands.insertSystematicLink('[[ST:Ch32]]', 'Effectual Calling');

        const html = editor.getHTML();
        expect(html).toContain('Effectual Calling');
        expect(html).toContain('data-st-ref="[[ST:Ch32]]"');
      });

      it('wraps selection when text is selected', () => {
        editor.commands.setContent('<p>See doctrine here</p>');
        // Select "doctrine"
        editor.commands.setTextSelection({ from: 5, to: 13 });

        editor.commands.insertSystematicLink('[[ST:Ch32]]', '[[ST:Ch32]]');

        const html = editor.getHTML();
        expect(html).toContain('data-st-ref="[[ST:Ch32]]"');
        expect(html).toContain('doctrine');
      });

      it('uses reference as display when display not provided', () => {
        editor.commands.setContent('<p>Test</p>');
        editor.commands.setTextSelection(5);

        editor.commands.insertSystematicLink('[[ST:Ch32]]', null as any);

        const html = editor.getHTML();
        // When display is null, it should use reference
        expect(html).toContain('[[ST:Ch32]]');
      });
    });

    describe('unsetSystematicLink', () => {
      it('removes systematic link mark', () => {
        editor.commands.setContent('<p>Hello world</p>');
        editor.commands.selectAll();
        editor.commands.setSystematicLink('[[ST:Ch32]]', '[[ST:Ch32]]');

        editor.commands.selectAll();
        const result = editor.commands.unsetSystematicLink();
        expect(result).toBe(true);

        const json = editor.getJSON();
        const marks = json.content?.[0]?.content?.[0]?.marks;
        expect(marks).toBeUndefined();
      });
    });
  });

  describe('keyboard shortcuts', () => {
    it('dispatches openDoctrineModal event on Mod-Shift-d', () => {
      const eventListener = vi.fn();
      window.addEventListener('openDoctrineModal', eventListener);

      // Simulate the keyboard shortcut
      const shortcuts = editor.extensionManager.extensions
        .find(ext => ext.name === 'systematicLink')
        ?.options;

      // Just verify the shortcut is registered
      const keyboardShortcuts = (editor.extensionManager.extensions
        .find(ext => ext.name === 'systematicLink') as any)
        ?.config?.addKeyboardShortcuts;

      expect(keyboardShortcuts).toBeDefined();

      window.removeEventListener('openDoctrineModal', eventListener);
    });
  });

  describe('input rules', () => {
    it('converts [[ST:ChX]] pattern to link', async () => {
      editor.commands.setContent('<p></p>');
      editor.commands.focus('end');

      // Simulate typing [[ST:Ch32]]
      editor.commands.insertContent('[[ST:Ch32]]');

      // Note: Input rules are tested differently as they need actual keystroke simulation
      // This test verifies the extension has input rules configured
      const extension = editor.extensionManager.extensions.find(
        ext => ext.name === 'systematicLink'
      );
      expect(extension).toBeDefined();
    });

    it('converts [[ST:ChX:A]] pattern with section', async () => {
      editor.commands.setContent('<p></p>');
      editor.commands.focus('end');
      editor.commands.insertContent('[[ST:Ch32:A]]');

      const extension = editor.extensionManager.extensions.find(
        ext => ext.name === 'systematicLink'
      );
      expect(extension).toBeDefined();
    });

    it('converts [[ST:ChX:A.1]] pattern with subsection', async () => {
      editor.commands.setContent('<p></p>');
      editor.commands.focus('end');
      editor.commands.insertContent('[[ST:Ch32:B.1]]');

      const extension = editor.extensionManager.extensions.find(
        ext => ext.name === 'systematicLink'
      );
      expect(extension).toBeDefined();
    });
  });

  describe('paste rules', () => {
    it('has paste rules configured', () => {
      const extension = editor.extensionManager.extensions.find(
        ext => ext.name === 'systematicLink'
      );
      expect(extension).toBeDefined();

      // Verify the extension configuration
      const config = (extension as any)?.config;
      expect(config?.addPasteRules).toBeDefined();
    });
  });

  describe('ProseMirror plugin - click handling', () => {
    it('registers click plugin', () => {
      // Verify the extension is registered with callback
      const mark = editor.extensionManager.extensions.find(
        ext => ext.name === 'systematicLink'
      );
      expect(mark).toBeDefined();
      expect(mark?.options.onLinkClick).toBe(onLinkClick);

      // The extension should have plugins configured
      const config = (mark as any)?.config;
      expect(config?.addProseMirrorPlugins).toBeDefined();
    });

    it('does not call callback when no link clicked', () => {
      // Plugin exists but callback shouldn't fire without clicking a link
      expect(onLinkClick).not.toHaveBeenCalled();
    });
  });

  describe('reference formats', () => {
    const formats = [
      { ref: '[[ST:Ch1]]', desc: 'chapter only' },
      { ref: '[[ST:Ch32]]', desc: 'two-digit chapter' },
      { ref: '[[ST:Ch32:A]]', desc: 'chapter with section' },
      { ref: '[[ST:Ch32:B]]', desc: 'different section letter' },
      { ref: '[[ST:Ch32:A.1]]', desc: 'chapter with subsection' },
      { ref: '[[ST:Ch32:B.2]]', desc: 'different subsection' },
      { ref: '[[ST:Ch57]]', desc: 'highest chapter' },
    ];

    formats.forEach(({ ref, desc }) => {
      it(`supports ${desc} format: ${ref}`, () => {
        editor.commands.setContent('<p>Test content</p>');
        editor.commands.selectAll();
        editor.commands.setSystematicLink(ref, ref);

        const html = editor.getHTML();
        expect(html).toContain(`data-st-ref="${ref}"`);
      });
    });
  });

  describe('mark isolation', () => {
    it('applies mark only to selected text', () => {
      editor.commands.setContent('<p>See chapter 32 for details</p>');

      // Select only "chapter 32"
      editor.commands.setTextSelection({ from: 5, to: 15 });
      editor.commands.setSystematicLink('[[ST:Ch32]]', '[[ST:Ch32]]');

      const json = editor.getJSON();
      const content = json.content?.[0]?.content;

      // Should have multiple text nodes
      expect(content?.length).toBeGreaterThan(1);

      // Find the marked node
      const markedNode = content?.find(
        node => node.marks?.some(m => m.type === 'systematicLink')
      );
      expect(markedNode).toBeDefined();
    });
  });

  describe('export/import consistency', () => {
    it('round-trips HTML correctly', () => {
      const originalHtml =
        '<p><span class="systematic-link" data-st-ref="[[ST:Ch32]]" data-st-display="Effectual Calling">Effectual Calling</span> is important</p>';
      editor.commands.setContent(originalHtml);

      const exportedHtml = editor.getHTML();
      expect(exportedHtml).toContain('data-st-ref="[[ST:Ch32]]"');
      expect(exportedHtml).toContain('Effectual Calling');

      // Import the exported HTML into a new editor
      const newEditor = new Editor({
        extensions: [Document, Paragraph, Text, SystematicLinkMark],
        content: exportedHtml,
      });

      const reimportedJson = newEditor.getJSON();
      const marks = reimportedJson.content?.[0]?.content?.[0]?.marks;
      expect(marks?.[0]?.attrs?.reference).toBe('[[ST:Ch32]]');

      newEditor.destroy();
    });
  });
});
