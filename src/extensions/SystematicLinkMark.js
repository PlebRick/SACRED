import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Systematic Theology Link Mark
 *
 * Renders [[ST:ChX]] links as styled, clickable elements.
 * Format: [[ST:Ch32]], [[ST:Ch32:A]], [[ST:Ch32:B.1]]
 */
export const SystematicLinkMark = Mark.create({
  name: 'systematicLink',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'systematic-link',
      },
      onLinkClick: null, // callback for when link is clicked
    };
  },

  addAttributes() {
    return {
      reference: {
        default: null,
        parseHTML: element => element.getAttribute('data-st-ref'),
        renderHTML: attributes => {
          if (!attributes.reference) return {};
          return { 'data-st-ref': attributes.reference };
        },
      },
      // Store the display text
      display: {
        default: null,
        parseHTML: element => element.getAttribute('data-st-display'),
        renderHTML: attributes => {
          if (!attributes.display) return {};
          return { 'data-st-display': attributes.display };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-st-ref]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setSystematicLink: (reference, display) => ({ commands }) => {
        return commands.setMark(this.name, { reference, display });
      },
      insertSystematicLink: (reference, display) => ({ chain, state }) => {
        const { from, to } = state.selection;
        // If there's a selection, wrap it; otherwise insert the display text
        if (from === to) {
          return chain()
            .insertContent({
              type: 'text',
              text: display || reference,
              marks: [{ type: this.name, attrs: { reference, display } }],
            })
            .run();
        }
        return chain().setMark(this.name, { reference, display }).run();
      },
      unsetSystematicLink: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-d': () => {
        // Trigger the insert doctrine modal via a custom event
        window.dispatchEvent(new CustomEvent('openDoctrineModal'));
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const { onLinkClick } = this.options;

    return [
      new Plugin({
        key: new PluginKey('systematicLinkClick'),
        props: {
          handleClick: (view, pos, event) => {
            const { state } = view;
            const { doc } = state;

            // Get the marks at this position
            const $pos = doc.resolve(pos);
            const marks = $pos.marks();

            // Find systematic link mark
            const linkMark = marks.find(mark => mark.type.name === 'systematicLink');

            if (linkMark && onLinkClick) {
              const reference = linkMark.attrs.reference;
              if (reference) {
                event.preventDefault();
                onLinkClick(reference);
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

export default SystematicLinkMark;
