import { test, expect } from '@playwright/test';

test.describe('Omok Multiplayer Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('should display room selection screen initially', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('오목 게임');
    await expect(page.locator('text=방 만들기')).toBeVisible();
    await expect(page.locator('text=방 참여하기')).toBeVisible();
  });

  test('should allow creating a room', async ({ page }) => {
    await page.fill('input[placeholder="이름을 입력하세요"]', 'Player1');
    await page.fill('input[placeholder="방 이름을 입력하세요"]', 'Test Room');
    await page.click('button:has-text("방 만들기")');
    
    // Should show room info after creating
    await expect(page.locator('text=방 ID:')).toBeVisible();
    await expect(page.locator('text=참가자: 1/2')).toBeVisible();
  });

  test('should show game board when in a room', async ({ page }) => {
    // Create a room first
    await page.fill('input[placeholder="이름을 입력하세요"]', 'Player1');
    await page.fill('input[placeholder="방 이름을 입력하세요"]', 'Test Room');
    await page.click('button:has-text("방 만들기")');
    
    // Should show game board
    await expect(page.locator('[style*="display: grid"]')).toBeVisible();
    await expect(page.locator('text=게임을 시작하려면 2명의 플레이어가 필요합니다')).toBeVisible();
  });

  test('should allow leaving a room', async ({ page }) => {
    // Create a room first
    await page.fill('input[placeholder="이름을 입력하세요"]', 'Player1');
    await page.fill('input[placeholder="방 이름을 입력하세요"]', 'Test Room');
    await page.click('button:has-text("방 만들기")');
    
    // Leave the room
    await page.click('button:has-text("방 나가기")');
    
    // Should return to room selection
    await expect(page.locator('text=방 만들기')).toBeVisible();
    await expect(page.locator('text=방 참여하기')).toBeVisible();
  });

  test('should switch between create and join room tabs', async ({ page }) => {
    // Initially on create room tab
    await expect(page.locator('input[placeholder="방 이름을 입력하세요"]')).toBeVisible();
    
    // Switch to join room tab
    await page.click('button:has-text("방 참여하기")');
    await expect(page.locator('input[placeholder="방 ID를 입력하세요"]')).toBeVisible();
    
    // Switch back to create room tab
    await page.click('button:has-text("방 만들기")');
    await expect(page.locator('input[placeholder="방 이름을 입력하세요"]')).toBeVisible();
  });

  test('should show error for empty form submission', async ({ page }) => {
    // Try to create room without filling form
    await page.click('button[type="submit"]');
    
    // Form validation should prevent submission
    await expect(page.locator('input[required]')).toBeFocused();
  });

  test('should display player list in room', async ({ page }) => {
    // Create a room
    await page.fill('input[placeholder="이름을 입력하세요"]', 'TestPlayer');
    await page.fill('input[placeholder="방 이름을 입력하세요"]', 'Test Room');
    await page.click('button:has-text("방 만들기")');
    
    // Should show player in the list
    await expect(page.locator('text=TestPlayer')).toBeVisible();
    await expect(page.locator('text=흑돌')).toBeVisible();
  });
});

test.describe('Game Board Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    // Create a room for testing
    await page.fill('input[placeholder="이름을 입력하세요"]', 'Player1');
    await page.fill('input[placeholder="방 이름을 입력하세요"]', 'Test Room');
    await page.click('button:has-text("방 만들기")');
  });

  test('should show 15x15 game board', async ({ page }) => {
    const gridCells = page.locator('[style*="display: grid"] > div');
    await expect(gridCells).toHaveCount(225); // 15 * 15 = 225
  });

  test('should not allow game actions without two players', async ({ page }) => {
    // Start game button should not be available with only 1 player
    await expect(page.locator('button:has-text("게임 시작")')).not.toBeVisible();
    await expect(page.locator('text=게임을 시작하려면 2명의 플레이어가 필요합니다')).toBeVisible();
  });
});