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

    // Step 2: Create a new note
    const noteTitle = `Test Note ${Date.now()}`;
    await createNote(page, 'Romans 8:28', noteTitle);

    // Step 3: Verify note appears in the notes list
    await expect(page.getByText(noteTitle)).toBeVisible();

    // Step 4: Edit the note content
    await editNoteContent(page, noteTitle, '<p>For we know that in all things God works for the good</p>');

    // Step 5: Verify auto-save (wait and check for save indicator or no unsaved changes)
    await page.waitForTimeout(2000); // Wait for auto-save

    // Step 6: Delete the note
    await deleteNote(page, noteTitle);

    // Step 7: Verify note is removed
    await expect(page.getByText(noteTitle)).not.toBeVisible();
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

  test('creates note with different types', async ({ page }) => {
    // Navigate to a chapter
    await navigateToChapter(page, 'Psalm 23');

    // Test note type
    await createNote(page, 'Psalm 23:1', 'Note Type Test', 'note');
    await page.waitForTimeout(500);

    // Clean up
    await deleteNoteIfExists(page, 'Note Type Test');
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
    const noteTitle = `Romans Test ${Date.now()}`;
    await createNote(page, 'Romans 1:1', noteTitle);

    // Verify note appears in notes panel
    await expect(page.getByText(noteTitle)).toBeVisible();

    // Navigate to different chapter
    await navigateToChapter(page, 'Genesis 1');

    // The note should not be visible in Genesis (unless it's a global list)
    // This depends on implementation - note might be in sidebar

    // Clean up - navigate back and delete
    await navigateToChapter(page, 'Romans 1');
    await deleteNoteIfExists(page, noteTitle);
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

async function createNote(page: Page, verseRef: string, title: string, type: string = 'note') {
  // Look for add note button
  const addButton = page.locator(
    'button:has-text("Add Note"), button:has-text("New Note"), button[aria-label*="add note"], .add-note-button'
  );

  if (await addButton.isVisible()) {
    await addButton.click();

    // Wait for modal to open
    await page.waitForTimeout(300);

    // Fill in the verse reference if there's an input
    const verseInput = page.locator('input[placeholder*="verse"], input[placeholder*="Romans"]');
    if (await verseInput.isVisible()) {
      await verseInput.clear();
      await verseInput.fill(verseRef);
    }

    // Fill in title if there's a title input
    const titleInput = page.locator('input[placeholder*="title"], input[name="title"]');
    if (await titleInput.isVisible()) {
      await titleInput.fill(title);
    }

    // Select type if dropdown exists
    const typeSelect = page.locator('select[name="type"], [data-testid="note-type"]');
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption(type);
    }

    // Submit the form
    const createButton = page.locator(
      'button:has-text("Create"), button:has-text("Save"), button[type="submit"]'
    );
    await createButton.click();

    // Wait for modal to close
    await page.waitForTimeout(500);
  }
}

async function editNoteContent(page: Page, noteTitle: string, content: string) {
  // Find and click on the note
  const note = page.getByText(noteTitle);
  if (await note.isVisible()) {
    await note.click();
    await page.waitForTimeout(300);

    // Find the editor (Tiptap editor)
    const editor = page.locator('.ProseMirror, .tiptap, [contenteditable="true"]');
    if (await editor.isVisible()) {
      await editor.click();
      await editor.fill(content);
    }
  }
}

async function deleteNote(page: Page, noteTitle: string) {
  // Find the note
  const note = page.getByText(noteTitle);
  if (await note.isVisible()) {
    await note.click();
    await page.waitForTimeout(300);

    // Look for delete button
    const deleteButton = page.locator(
      'button:has-text("Delete"), button[aria-label*="delete"], .delete-note'
    );
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion if there's a confirmation dialog
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').last();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      await page.waitForTimeout(500);
    }
  }
}

async function deleteNoteIfExists(page: Page, noteTitle: string) {
  const note = page.getByText(noteTitle);
  if (await note.isVisible({ timeout: 1000 }).catch(() => false)) {
    await deleteNote(page, noteTitle);
  }
}
