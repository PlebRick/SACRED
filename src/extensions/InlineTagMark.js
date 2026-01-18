import { Mark } from '@tiptap/core';

export const InlineTagMark = Mark.create({
  name: 'inlineTag',

  addOptions() {
    return {
      HTMLAttributes: {},
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
});

export default InlineTagMark;
