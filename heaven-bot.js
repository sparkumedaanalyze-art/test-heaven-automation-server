import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

const HEAVEN_URL = process.env.HEAVEN_URL || 'https://heaven-url.com';
const HEAVEN_USER = process.env.HEAVEN_USER;
const HEAVEN_PASS = process.env.HEAVEN_PASS;

/**
 * ヘブンに予約データを自動登録する
 * @param {Object} reservationData - 予約データ
 */
export async function syncToHeaven(reservationData) {
  let browser;
  const startTime = Date.now();
  
  try {
    console.log(`🌐 Starting Heaven sync for reservation #${reservationData.reservation_id}`);
    
    // ブラウザ起動
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // ===== ステップ1: pro-managerに直接ログイン =====
    console.log('🔐 Step 1: Logging in to pro-manager...');
    await page.goto('https://pro-manager.cityheaven.net/login/', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // ログインフォーム入力
    await page.waitForSelector('#loginId', { timeout: 10000 });
    await page.type('#loginId', HEAVEN_USER, { delay: 50 });
    await page.type('#password', HEAVEN_PASS, { delay: 50 });
    
    // ログインフォームをsubmit（JavaScriptで直接実行）
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.evaluate(() => {
        document.querySelector('.login-form').submit();
      })
    ]);
    
    // ログイン後2秒待機
    await page.waitForTimeout(2000);
    
    // ログイン成功を確認
    const currentUrl = page.url();
    console.log(`📍 Current URL after login: ${currentUrl}`);
    
    if (currentUrl.includes('/login')) {
      throw new Error('Login failed - still on login page');
    }
    
    console.log('✓ Logged in to pro-manager');
    
    // ===== ステップ2: 受付台帳 =====
    console.log('📋 Step 2: Opening reception ledger...');
    await page.goto(`https://pro-manager.cityheaven.net/reservation/timechart`, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    await page.waitForTimeout(5000); // JavaScriptの読み込みと実行を待つ
    console.log('✓ Opened reception ledger');
    
    // ===== ステップ3: 簡単受付 =====
    console.log('✏️ Step 3: Opening quick registration...');
    await page.waitForSelector('#new_reservation', { timeout: 15000 });
    await page.click('#new_reservation');
    await page.waitForTimeout(2000);
    console.log('✓ Opened quick registration');
    
    // ===== ステップ4: コース選択 =====
    console.log(`⏱️ Step 4: Selecting course (${reservationData.course}分)...`);
    
    // コース番号に対応するラベルを選択
    const courseMap = {
      '60': 'course_id_221687',
      '75': 'course_id_221688',
      '90': 'course_id_221689',
      '120': 'course_id_221690',
      '180': 'course_id_221691',
      '240': 'course_id_221692'
    };
    
    const courseId = courseMap[reservationData.course];
    if (!courseId) {
      throw new Error(`Unknown course: ${reservationData.course}分`);
    }
    
    await page.waitForSelector(`label[for="${courseId}"]`, { timeout: 10000 });
    await page.click(`label[for="${courseId}"]`);
    await page.waitForTimeout(1000);
    console.log(`✓ Course selected: ${reservationData.course}分`);
    
    // ===== ステップ5: キャストの時間選択 =====
    console.log(`👩 Step 5: Selecting cast (${reservationData.cast_name})...`);
    
    // キャスト名からgirl_idを検索（画面上のテキストから）
    await page.waitForTimeout(2000); // キャスト一覧が表示されるまで待つ
    
    // キャスト名を含む要素を探してクリック
    const castClicked = await page.evaluate((castName) => {
      const elements = Array.from(document.querySelectorAll('div.sc_Bar'));
      const targetElement = elements.find(el => {
        const text = el.textContent || '';
        return text.includes(castName);
      });
      
      if (targetElement) {
        const clickableArea = targetElement.querySelector('a') || targetElement;
        clickableArea.click();
        return true;
      }
      return false;
    }, reservationData.cast_name);
    
    if (!castClicked) {
      throw new Error(`Cast not found: ${reservationData.cast_name}`);
    }
    
    await page.waitForTimeout(1000);
    console.log('✓ Cast selected');
    
    // ===== ステップ6: 詳しい時間帯選択（5分ごと） =====
    console.log(`🕐 Step 6: Selecting time slot...`);
    const reservationTime = new Date(reservationData.reservation_time);
    const hours = String(reservationTime.getHours()).padStart(2, '0');
    const minutes = String(reservationTime.getMinutes()).padStart(2, '0');
    const timeSlot = `${hours}:${minutes}`;
    
    // 時間選択のラベルをクリック
    await page.waitForSelector(`label.time_btn[for*="time_${hours}${minutes}"]`, { timeout: 10000 });
    await page.click(`label.time_btn[for*="time_${hours}${minutes}"]`);
    await page.waitForTimeout(1000);
    console.log(`✓ Time slot selected: ${timeSlot}`);
    
    // ===== ステップ7: 登録する =====
    console.log('📝 Step 7: Clicking register button...');
    await page.waitForSelector('#btn-save', { timeout: 10000 });
    await page.click('#btn-save');
    await page.waitForTimeout(3000); // 予約が作成されるまで待つ
    console.log('✓ Registration initiated');
    
    // ===== ステップ8: 顧客未登録バーをクリック =====
    console.log('👤 Step 8: Opening customer registration...');
    
    // 「顧客未登録」の予約バーを探してクリック
    const customerBarClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('.title'));
      const targetElement = elements.find(el => el.textContent.includes('顧客未登録'));
      
      if (targetElement) {
        const parent = targetElement.closest('.head');
        if (parent) {
          parent.click();
          return true;
        }
      }
      return false;
    });
    
    if (!customerBarClicked) {
      throw new Error('Customer registration bar not found');
    }
    
    await page.waitForTimeout(2000);
    console.log('✓ Customer bar clicked');
    
    // ===== ステップ9: 予約編集ボタンクリック =====
    console.log('✏️ Step 9: Clicking edit button...');
    await page.waitForSelector('#modal_detail_view', { timeout: 10000 });
    await page.click('#modal_detail_view');
    await page.waitForTimeout(3000); // モーダルが開くまで待つ
    console.log('✓ Edit modal opened');
    
    // ===== ステップ10: 顧客情報入力 =====
    console.log('📝 Step 10: Filling customer details...');
    
    // 電話番号
    await page.waitForSelector('#reservation_phone_number', { timeout: 10000 });
    await page.click('#reservation_phone_number', { clickCount: 3 }); // 既存テキスト選択
    await page.type('#reservation_phone_number', reservationData.customer_phone, { delay: 50 });
    console.log(`✓ Phone: ${reservationData.customer_phone}`);
    
    // 会員番号（あれば）
    if (reservationData.member_number) {
      await page.waitForSelector('#shop_member_no', { timeout: 10000 });
      await page.click('#shop_member_no', { clickCount: 3 });
      await page.type('#shop_member_no', reservationData.member_number, { delay: 50 });
      console.log(`✓ Member No: ${reservationData.member_number}`);
    }
    
    // 顧客名
    if (reservationData.customer_name) {
      await page.waitForSelector('input[name*="customer_name"]', { timeout: 10000 });
      await page.click('input[name*="customer_name"]', { clickCount: 3 });
      await page.type('input[name*="customer_name"]', reservationData.customer_name, { delay: 50 });
      console.log(`✓ Name: ${reservationData.customer_name}`);
    }
    
    // ===== ステップ11: 保存 =====
    console.log('💾 Step 11: Saving registration...');
    await page.waitForSelector('#button-save', { timeout: 10000 });
    await page.click('#button-save');
    await page.waitForTimeout(3000); // 保存完了を待つ
    console.log('✓ Registration saved');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🎉 Heaven sync completed successfully in ${duration}s`);
    
    return {
      success: true,
      reservation_id: reservationData.reservation_id,
      duration: duration
    };
    
  } catch (error) {
    console.error('❌ Heaven sync error:', error.message);
    
    // エラー時のスクリーンショット保存
    if (browser) {
      try {
        const pages = await browser.pages();
        if (pages.length > 0) {
          const screenshotPath = `error-${reservationData.reservation_id}-${Date.now()}.png`;
          await pages[0].screenshot({ 
            path: screenshotPath,
            fullPage: true 
          });
          console.log(`📸 Error screenshot saved: ${screenshotPath}`);
        }
      } catch (screenshotError) {
        console.error('Failed to save screenshot:', screenshotError.message);
      }
    }
    
    throw error;
    
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}
