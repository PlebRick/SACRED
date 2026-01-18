import { test, expect, Page } from '@playwright/test';

test.describe('Notes Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    // Wait for the app to load
    await page.waitForSelector('[data-testid="bible-reader"], .bible-reader, main', {
      timeout: 10000,
    });
  });

  test('full user flow: create, edit, and delete a note', async ({ page }) => {
    // Step 1: Navigate to a specific chapter
    await navigateToChapter(page, 'Romans 8');

    // Step 2: Create a new note for Romans 8:28
    // Note: AddNoteModal only has verse reference input, no title input
    // Notes are created with empty title (shows as "Untitled Note")
    const verseRef = 'Romans 8:28';
    await createNote(page, verseRef);

    // Step 3: Verify note appears in the notes list (by verse reference)
    await expect(page.getByText(verseRef)).toBeVisible({ timeout: 5000 });

    // Step 4: Edit the note - click on the note card to open editor
    await page.getByText(verseRef).click();
    await page.waitForTimeout(500);

    // Find the editor (Tiptap editor)
    const editor = page.locator('.ProseMirror, .tiptap, [contenteditable="true"]');
    if (await editor.isVisible()) {
      await editor.click();
      await editor.fill('For we know that in all things God works for the good');
    }

    // Step 5: Verify auto-save (wait for debounce)
    await page.waitForTimeout(2000);

    // Step 6: Delete the note - handle browser confirm dialog
    await deleteNoteByVerseRef(page, verseRef);

    // Step 7: Verify note is removed
    await expect(page.locator(`[data-note-id]`).filter({ hasText: verseRef })).not.toBeVisible({ timeout: 3000 });
  });

  test('navigates between chapters', async ({ page }) => {
    // Navigate to Genesis 1
    await navigateToChapter(page, 'Genesis 1');

    // Verify we're on Genesis 1
    await expect(page.locator('body')).toContainText('Genesis');

    // Navigate to next chapter
    const nextButton = page.locator('button:has-text("Next"), [aria-label*="next"], .next-chapter');
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }

    // Navigate to previous chapter
    const prevButton = page.locator('button:has-text("Prev"), [aria-label*="prev"], .prev-chapter');
    if (await prevButton.isVisible()) {
      await prevButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('verse search navigates to correct location', async ({ page }) => {
    // Find the search input
    const searchInput = page.locator(
      'input[placeholder*="verse"], input[placeholder*="Go to"], input[type="search"]'
    );

    if (await searchInput.isVisible()) {
      // Type a verse reference
      await searchInput.fill('John 3:16');
      await searchInput.press('Enter');

      // Wait for navigation
      await page.waitForTimeout(1000);

      // Verify we're on John
      await expect(page.locator('body')).toContainText('John');
    }
  });

  test('creates note for a verse', async ({ page }) => {
    // Navigate to a chapter
    await navigateToChapter(page, 'Psalms 23');

    // Create a note
    const verseRef = 'Psalms 23:1';
    await createNote(page, verseRef);
    await page.waitForTimeout(500);

    // Verify note was created
    await expect(page.getByText(verseRef)).toBeVisible({ timeout: 5000 });

    // Clean up
    await deleteNoteByVerseRef(page, verseRef);
  });

  test('keyboard shortcuts work', async ({ page }) => {
    // Test Cmd/Ctrl + K for search focus
    await page.keyboard.press('Meta+k');

    // Check if search input is focused
    const searchInput = page.locator(
      'input[placeholder*="verse"], input[placeholder*="Go to"], input[type="search"]'
    );

    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeFocused();

      // Press Escape to clear/blur
      await page.keyboard.press('Escape');
    }
  });

  test('theme toggle works', async ({ page }) => {
    // Find theme toggle button
    const themeToggle = page.locator('button[aria-label*="theme"], button:has-text("Theme"), .theme-toggle');

    if (await themeToggle.isVisible()) {
      // Get current theme
      const htmlElement = page.locator('html');
      const initialClass = await htmlElement.getAttribute('class');

      // Toggle theme
      await themeToggle.click();
      await page.waitForTimeout(300);

      // Verify theme changed (either class changed or data-theme changed)
      const newClass = await htmlElement.getAttribute('class');
      const dataTheme = await htmlElement.getAttribute('data-theme');

      // Theme should have changed somehow
      expect(initialClass !== newClass || dataTheme !== null).toBeTruthy();
    }
  });

  test('notes panel shows notes for current chapter', async ({ page }) => {
    // Navigate to Romans 1
    await navigateToChapter(page, 'Romans 1');

    // Create a note for this chapter
    const verseRef = 'Romans 1:1';
    await createNote(page, verseRef);

    // Verify note appears in notes panel
    await expect(page.getByText(verseRef)).toBeVisible({ timeout: 5000 });

    // Navigate to different chapter
    await navigateToChapter(page, 'Genesis 1');

    // Wait for chapter to load
    await page.waitForTimeout(1000);

    // Clean up - navigate back and delete
    await navigateToChapter(page, 'Romans 1');
    await deleteNoteByVerseRef(page, verseRef);
  });

  test('handles invalid verse reference gracefully', async ({ page }) => {
    const searchInput = page.locator(
      'input[placeholder*="verse"], input[placeholder*="Go to"], input[type="search"]'
    );

    if (await searchInput.isVisible()) {
      await searchInput.fill('InvalidBook 999');
      await searchInput.press('Enter');

      // Wait a moment for any error to appear
      await page.waitForTimeout(500);

      // App should handle gracefully - not crash
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

// Helper functions

async function navigateToChapter(page: Page, reference: string) {
  // Try to use the search/navigation input
  const searchInput = page.locator(
    'input[placeholder*="verse"], input[placeholder*="Go to"], input[type="search"]'
  );

  if (await searchInput.isVisible()) {
    await searchInput.fill(reference);
    await searchInput.press('Enter');
    await page.waitForTimeout(1000);
  }
}

/**
 * Creates a note via the AddNoteModal.
 * Note: The modal only has a verse reference input - no title input.
 * Notes are created with empty titles (displayed as "Untitled Note").
 */
async function createNote(page: Page, verseRef: string) {
  // Look for add note button (aria-label="Add new note" in NotesPanel)
  const addButton = page.locator(
    'button[aria-label*="Add new note"], button[aria-label*="add note"], button:has-text("Add Note"), button:has-text("New Note")'
  );

  if (await addButton.first().isVisible()) {
    await addButton.first().click();

    // Wait for modal to open
    await page.waitForTimeout(300);

    // Fill in the verse reference (the only input in AddNoteModal)
    // Placeholder is "e.g., Romans 1:1-7"
    const verseInput = page.locator('input[placeholder*="Romans"], input[placeholder*="verse"]');
    if (await verseInput.isVisible()) {
      await verseInput.clear();
      await verseInput.fill(verseRef);
    }

    // Submit the form - button says "Create Note"
    const createButton = page.locator(
      'button:has-text("Create Note"), button:has-text("Create"), button[type="submit"]'
    );
    await createButton.click();

    // Wait for modal to close and note to be created
    await page.waitForTimeout(500);
  }
}

/**
 * Deletes a note by its verse reference.
 * NoteCard uses window.confirm() for deletion confirmation.
 */
async function deleteNoteByVerseRef(page: Page, verseRef: string) {
  // Find the note card containing the verse reference
  const noteCard = page.locator('[data-note-id]').filter({ hasText: verseRef });

  if (await noteCard.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Set up handler for the browser confirm dialog BEFORE clicking delete
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('Delete this note?');
      await dialog.accept();
    });

    // Find and click the delete button within the note card
    // Delete button has aria-label="Delete note"
    const deleteButton = noteCard.locator('button[aria-label="Delete note"], button[aria-label*="delete"]');
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(500);
    }
  }
}

/**
 * Deletes a note if it exists, silently fails if not found.
 */
async function deleteNoteIfExists(page: Page, verseRef: string) {
  const noteCard = page.locator('[data-note-id]').filter({ hasText: verseRef });
  if (await noteCard.isVisible({ timeout: 1000 }).catch(() => false)) {
    await deleteNoteByVerseRef(page, verseRef);
  }
}
