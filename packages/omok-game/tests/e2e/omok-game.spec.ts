import { test, expect } from '@playwright/test';

test.describe('Omok Game E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the main page title and content', async ({ page }) => {
    await expect(page).toHaveTitle(/Omok Game/);
    await expect(page.getByRole('heading', { name: 'Omok Game' })).toBeVisible();
    await expect(page.getByText('Real-time Five-in-a-Row')).toBeVisible();
  });

  test('should show player name input form initially', async ({ page }) => {
    await expect(page.getByText('Enter Your Name')).toBeVisible();
    await expect(page.getByPlaceholder('Your name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });

  test('should allow user to enter name and show room list', async ({ page }) => {
    // Enter player name
    await page.getByPlaceholder('Your name').fill('Test Player');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Should show room list
    await expect(page.getByText('Game Rooms')).toBeVisible();
    await expect(page.getByText('Playing as: Test Player')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
  });

  test('should show create room form when create room button is clicked', async ({ page }) => {
    // Enter player name first
    await page.getByPlaceholder('Your name').fill('Test Player');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Click create room
    await page.getByRole('button', { name: 'Create Room' }).click();

    // Should show create room form
    await expect(page.getByPlaceholder('Room name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('should show WebSocket connection status', async ({ page }) => {
    await expect(page.getByText('Make sure the WebSocket server is running on port 8080')).toBeVisible();
    await expect(page.getByText('npm run server')).toBeVisible();
  });

  test('should show game board and info when in a room (mock)', async ({ page }) => {
    // This test would require a running WebSocket server
    // For now, we'll test the UI elements that should be present
    
    // Enter player name
    await page.getByPlaceholder('Your name').fill('Test Player');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Check that Game Info component is present
    await expect(page.getByText('Game Status')).toBeVisible();
    await expect(page.getByText('No active game')).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Test keyboard navigation for name input
    await page.getByPlaceholder('Your name').focus();
    await page.keyboard.type('Test Player');
    await page.keyboard.press('Enter');

    // Should proceed to room list
    await expect(page.getByText('Game Rooms')).toBeVisible();
  });

  test('should disable continue button when name is empty', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeDisabled();

    // Type something and button should be enabled
    await page.getByPlaceholder('Your name').fill('Test');
    await expect(continueButton).toBeEnabled();

    // Clear input and button should be disabled again
    await page.getByPlaceholder('Your name').clear();
    await expect(continueButton).toBeDisabled();
  });

  test('should show empty room list when no rooms available', async ({ page }) => {
    // Enter player name
    await page.getByPlaceholder('Your name').fill('Test Player');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Should show empty room message
    await expect(page.getByText('No rooms available')).toBeVisible();
  });
});