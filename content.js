// content.js

// --- 設定 ---
const MIN_DELAY = 1000;  // 1秒（通常速度）
const MAX_DELAY = 3000;  // 3秒
const SESSION_LIMIT = 49;     // 1回の連続実行上限
const COOLDOWN_TIME = 15 * 60; // 15分（秒換算）
const DAILY_LIMIT = 990;      // 1日の上限（999ギリギリは怖いので990で停止）

// --- 変数 ---
let isRunning = false;
let isCoolingDown = false;
let timer = null;
let cooldownTimer = null;
let sessionCount = 0; // 今回のセッションでのいいね数

// --- ストレージ管理（1日の制限用） ---
function getDailyData() {
  const today = new Date().toLocaleDateString();
  const data = JSON.parse(localStorage.getItem('tw_auto_like_data') || '{}');
  
  // 日付が変わっていたらリセット
  if (data.date !== today) {
    return { date: today, count: 0 };
  }
  return data;
}

function incrementDailyCount() {
  const data = getDailyData();
  data.count++;
  localStorage.setItem('tw_auto_like_data', JSON.stringify(data));
  return data.count;
}

function getDailyCount() {
  return getDailyData().count;
}

// --- UI作成 ---
const panel = document.createElement('div');
panel.style.cssText = `
  position: fixed; bottom: 20px; right: 20px; width: 260px;
  background: rgba(0, 0, 0, 0.9); color: #fff; padding: 15px;
  border-radius: 10px; z-index: 9999; font-family: sans-serif; font-size: 13px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.5); border: 1px solid #333;
`;

// ステータス表示エリア
const statusArea = document.createElement('div');
statusArea.style.cssText = "margin-bottom: 10px; font-weight: bold; text-align: center; color: #0f0;";
statusArea.innerText = "待機中";

// カウンター表示エリア
const countArea = document.createElement('div');
countArea.style.cssText = "margin-bottom: 10px; font-size: 12px; color: #ccc; line-height: 1.5;";
updateCountDisplay();

// ログエリア
const logArea = document.createElement('div');
logArea.style.cssText = `
  height: 80px; overflow-y: auto; background: #222; margin-bottom: 10px;
  padding: 5px; border: 1px solid #444; border-radius: 4px; font-family: monospace; font-size: 11px;
`;

// ボタン
const actionBtn = document.createElement('button');
actionBtn.innerText = "▶ 開始";
actionBtn.style.cssText = `
  width: 100%; padding: 10px; background: #1d9bf0; color: white;
  border: none; border-radius: 20px; cursor: pointer; font-weight: bold;
`;

panel.appendChild(statusArea);
panel.appendChild(countArea);
panel.appendChild(logArea);
panel.appendChild(actionBtn);
document.body.appendChild(panel);

// --- ヘルパー関数 ---
function log(msg) {
  const time = new Date().toLocaleTimeString().split(' ')[0];
  const p = document.createElement('div');
  p.innerText = `[${time}] ${msg}`;
  logArea.prepend(p);
}

function updateCountDisplay() {
  const daily = getDailyCount();
  countArea.innerHTML = `
    連続実行: <span style="color: #fff; font-weight:bold;">${sessionCount}</span> / ${SESSION_LIMIT}<br>
    本日合計: <span style="color: ${daily >= DAILY_LIMIT ? 'red' : '#fff'}; font-weight:bold;">${daily}</span> / 999
  `;
}

function getRandomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
}

function highlightTweet(button) {
  document.querySelectorAll('.auto-like-target').forEach(el => {
    el.style.border = 'none';
    el.classList.remove('auto-like-target');
  });
  if (button) {
    const article = button.closest('article');
    if (article) {
      article.style.border = '3px solid #1d9bf0'; // 青枠
      article.classList.add('auto-like-target');
    }
  }
}

// --- クールダウン処理（15分ロック） ---
function startCooldown() {
  isRunning = false;
  isCoolingDown = true;
  clearTimeout(timer);
  
  actionBtn.disabled = true;
  actionBtn.style.background = "#555";
  actionBtn.innerText = "休憩中 (ロック)";
  
  let remaining = COOLDOWN_TIME;
  
  log(`49回達成。15分間の休憩に入ります。`);
  
  cooldownTimer = setInterval(() => {
    remaining--;
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    statusArea.innerText = `休憩中: 残り ${m}分${s}秒`;
    statusArea.style.color = "yellow";

    if (remaining <= 0) {
      clearInterval(cooldownTimer);
      isCoolingDown = false;
      sessionCount = 0; // セッションリセット
      actionBtn.disabled = false;
      actionBtn.innerText = "▶ 再開可能";
      actionBtn.style.background = "#1d9bf0";
      statusArea.innerText = "準備完了";
      statusArea.style.color = "#0f0";
      updateCountDisplay();
      log("休憩終了。再開できます。");
    }
  }, 1000);
}

// --- 探索＆いいね処理 ---
function getNextLikeButton() {
  const articles = Array.from(document.querySelectorAll('article'));
  if (articles.length === 0) return null;

  let lastLikedIndex = -1;
  articles.forEach((article, index) => {
    if (article.querySelector('button[data-testid="unlike"]')) {
      lastLikedIndex = index;
    }
  });

  for (let i = lastLikedIndex + 1; i < articles.length; i++) {
    const likeBtn = articles[i].querySelector('button[data-testid="like"]');
    if (likeBtn) return likeBtn;
  }
  return null;
}

function autoLikeLoop() {
  if (!isRunning) return;

  // 1. 1日の上限チェック
  const daily = getDailyCount();
  if (daily >= DAILY_LIMIT) {
    isRunning = false;
    actionBtn.innerText = "上限到達";
    actionBtn.style.background = "#555";
    actionBtn.disabled = true;
    statusArea.innerText = "本日の上限(990回)に達しました";
    statusArea.style.color = "red";
    log("本日の上限に達しました。明日の朝まで停止します。");
    return;
  }

  // 2. セッション上限チェック (49回)
  if (sessionCount >= SESSION_LIMIT) {
    startCooldown();
    return;
  }

  const targetButton = getNextLikeButton();

  if (targetButton) {
    highlightTweet(targetButton);
    targetButton.scrollIntoView({ behavior: "auto", block: "center" });

    setTimeout(() => {
      if (!isRunning) return;
      
      targetButton.click();
      
      // カウント更新
      sessionCount++;
      const currentDaily = incrementDailyCount();
      updateCountDisplay();
      log(`いいね！ (連続${sessionCount} / 本日${currentDaily})`);
      highlightTweet(null);

      const nextDelay = getRandomDelay();
      timer = setTimeout(autoLikeLoop, nextDelay);
    }, 1000);

  } else {
    log("探索中...");
    highlightTweet(null);
    window.scrollBy(0, 400);
    timer = setTimeout(autoLikeLoop, 2000);
  }
}

// --- ボタンイベント ---
actionBtn.addEventListener('click', () => {
  if (isCoolingDown) return; // ロック中は無視

  if (isRunning) {
    // 停止
    isRunning = false;
    clearTimeout(timer);
    actionBtn.innerText = "▶ 開始";
    actionBtn.style.background = "#1d9bf0";
    statusArea.innerText = "停止中";
    statusArea.style.color = "#ccc";
    log("一時停止しました");
    highlightTweet(null);
  } else {
    // 開始
    if (getDailyCount() >= DAILY_LIMIT) {
      log("本日の上限を超えています");
      return;
    }
    isRunning = true;
    actionBtn.innerText = "■ 停止";
    actionBtn.style.background = "#f4212e";
    statusArea.innerText = "実行中";
    statusArea.style.color = "#0f0";
    log("開始します");
    autoLikeLoop();
  }
});

updateCountDisplay();
log("システム準備完了");