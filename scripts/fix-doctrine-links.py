#!/usr/bin/env python3
"""
Migration script to fix doctrine links in SACRED notes.

Two issues:
1. 38 notes have span markup with data-st-ref="[[ST:ChX]]" — should be data-st-ref="ChX"
2. 101 notes have raw [[ST:ChX]] text — should be wrapped in proper <span> markup

Run with --dry-run first to preview changes.
"""

import re
import sqlite3
import sys
from datetime import datetime

DB_PATH = "/home/ubuntu76/Projects/SACRED-PRIVATE/data/sacred.db"

# Fix 1: data-st-ref="[[ST:ChX]]" → data-st-ref="ChX"
BROKEN_ATTR_RE = re.compile(r'data-st-ref="\[\[ST:(Ch\d+(?::[A-Z](?:\.\d+)?)?)\]\]"')

# Match raw [[ST:ChX]] anywhere
RAW_LINK_RE = re.compile(r'\[\[ST:(Ch\d+(?::[A-Z](?:\.\d+)?)?)\]\]')


def fix_broken_attrs(content: str) -> str:
    """Fix data-st-ref="[[ST:ChX]]" → data-st-ref="ChX" """
    return BROKEN_ATTR_RE.sub(r'data-st-ref="\1"', content)


def dedupe_raw_links(content: str) -> str:
    """Remove duplicate [[ST:ChX]] in Related Doctrines blocks BEFORE converting to spans.
    Must run on raw text, not after span conversion."""
    def dedupe_block(match):
        block = match.group(0)
        seen = set()
        deduped = []
        for token in re.findall(r'\[\[ST:Ch\d+(?::[A-Z](?:\.\d+)?)?\]\]', block):
            ref = RAW_LINK_RE.match(token)
            if ref:
                key = ref.group(1)
                if key not in seen:
                    seen.add(key)
                    deduped.append(token)
        if deduped:
            return ' '.join(deduped)
        return block

    return re.sub(
        r'(?<=<strong>Related Doctrines:</strong> ).*?(?=</p>)',
        dedupe_block,
        content
    )


def fix_raw_links(content: str) -> str:
    """Convert raw [[ST:ChX]] text to proper span markup.
    Only converts occurrences NOT already inside a <span data-st-ref> element."""

    # Strategy: find all raw [[ST:ChX]] and check context to avoid double-wrapping
    def replace_raw(match):
        ref = match.group(1)  # e.g., "Ch33"
        full = match.group(0)  # e.g., "[[ST:Ch33]]"
        start = match.start()

        # Look backwards to check if we're inside a span attribute or text content
        preceding = content[max(0, start - 300):start]

        # Skip if inside a data-st-ref="..." attribute (shouldn't happen after fix_broken_attrs, but safe)
        if 'data-st-ref="' in preceding:
            after_attr = preceding[preceding.rfind('data-st-ref="'):]
            # If we haven't seen the closing quote + >, we're inside the attribute
            if '">' not in after_attr and '" ' not in after_attr[14:]:
                return full

        # Skip if inside a data-st-display="..." attribute
        if 'data-st-display="' in preceding:
            after_attr = preceding[preceding.rfind('data-st-display="'):]
            if '">' not in after_attr[17:]:
                return full

        # Skip if this is the text content of an existing systematic-link span
        # Pattern: ...data-st-display="...">[[ST:ChX]]
        if preceding.rstrip().endswith('>'):
            tag_start = preceding.rfind('<span')
            if tag_start >= 0 and 'data-st-ref' in preceding[tag_start:]:
                return full

        return f'<span class="systematic-link" data-st-ref="{ref}" data-st-display="{full}">{full}</span>'

    return RAW_LINK_RE.sub(replace_raw, content)


def migrate(dry_run: bool = True):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Find all notes with doctrine links
    notes = cur.execute(
        "SELECT id, title, content FROM notes WHERE content LIKE '%[[ST:Ch%' OR content LIKE '%data-st-ref%'"
    ).fetchall()

    fixed_count = 0
    attr_fixes = 0
    raw_fixes = 0

    for note in notes:
        original = note['content'] or ''
        updated = original

        # Count fixes before applying
        attr_count = len(BROKEN_ATTR_RE.findall(original))

        # Order matters:
        # 1. Dedupe raw links first (while they're still simple text)
        updated = dedupe_raw_links(updated)
        # 2. Fix broken span attributes
        updated = fix_broken_attrs(updated)
        # 3. Convert remaining raw links to spans (after attrs are fixed, to avoid false positives)
        content_before_raw = updated
        updated = fix_raw_links(updated)

        # Count raw fixes by comparing before/after step 3
        raw_count = len(RAW_LINK_RE.findall(content_before_raw)) - updated.count('data-st-ref') + content_before_raw.count('data-st-ref')

        if updated != original:
            fixed_count += 1
            attr_fixes += attr_count

            if dry_run:
                print(f"\n{'='*60}")
                print(f"Note: {note['title']} ({note['id'][:8]}...)")
                if attr_count:
                    print(f"  - Fix {attr_count} broken data-st-ref attributes")
                # Show a snippet of the final Related Doctrines block
                rd_match = re.search(r'Related Doctrines:.*?</p>', updated)
                if rd_match:
                    snippet = rd_match.group(0)[:200]
                    print(f"  - Doctrines block: ...{snippet}...")
            else:
                cur.execute(
                    "UPDATE notes SET content = ?, updated_at = ? WHERE id = ?",
                    (updated, datetime.now().isoformat(), note['id'])
                )

    if not dry_run:
        conn.commit()

    conn.close()

    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Notes {'to fix' if dry_run else 'fixed'}: {fixed_count}")
    print(f"  Broken attr fixes: {attr_fixes}")
    if dry_run:
        print(f"\nRun with --apply to execute migration.")
    else:
        print(f"\nMigration complete.")


if __name__ == '__main__':
    dry_run = '--apply' not in sys.argv
    if dry_run:
        print("DRY RUN — no changes will be made\n")
    else:
        print("APPLYING MIGRATION\n")
    migrate(dry_run=dry_run)
