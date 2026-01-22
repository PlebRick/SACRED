import { Mark } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const InlineTagMark = Mark.create({
  name: 'inlineTag',

  addOptions() {
    return {
      HTMLAttributes: {},
      onCrossRefClick: null, // callback for when a cross-ref tag is clicked
    };
  },

  addAttributes() {
    return {
      tagType: {
        default: null,
        parseHTML: element => element.getAttribute('data-inline-tag'),
        renderHTML: attributes => {
          if (!attributes.tagType) return {};
          return { 'data-inline-tag': attributes.tagType };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-inline-tag]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', { ...this.options.HTMLAttributes, ...HTMLAttributes }, 0];
  },

  addCommands() {
    return {
      setInlineTag: (tagType) => ({ commands }) => {
        return commands.setMark(this.name, { tagType });
      },
      toggleInlineTag: (tagType) => ({ commands }) => {
        return commands.toggleMark(this.name, { tagType });
      },
      unsetInlineTag: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
    };
  },

  addProseMirrorPlugins() {
    const { onCrossRefClick } = this.options;

    return [
      new Plugin({
        key: new PluginKey('inlineTagClick'),
        props: {
          handleClick: (view, pos, event) => {
            if (!onCrossRefClick) return false;

            const { state } = view;
            const { doc } = state;

            // Get the marks at this position
            const $pos = doc.resolve(pos);
            const marks = $pos.marks();

            // Find inline tag mark
            const tagMark = marks.find(mark => mark.type.name === 'inlineTag');

            if (tagMark && tagMark.attrs.tagType === 'crossref') {
              // Get the text content of the marked range
              const node = $pos.parent;
              let text = '';

              // Find the text covered by this mark
              node.forEach((child, offset) => {
                if (child.isText) {
                  const childMarks = child.marks;
                  const hasThisMark = childMarks.some(
                    m => m.type.name === 'inlineTag' && m.attrs.tagType === 'crossref'
                  );
                  if (hasThisMark) {
                    text += child.text;
                  }
                }
              });

              if (text) {
                event.preventDefault();
                onCrossRefClick(text.trim());
                return true;
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});

export default InlineTagMark;
