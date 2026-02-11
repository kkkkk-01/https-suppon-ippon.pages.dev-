// 審査員画面のJavaScript

// ============================================
// グローバル変数
// ============================================
let currentVoteCount = 0;
let hasVoted = false;
let isProcessing = false;
let currentSessionId = null;

// ============================================
// DOM要素
// ============================================
let vote0Btn, vote1Btn, vote2Btn, vote3Btn, yoBtn;
let currentVoteCountElement, feedback, feedbackText, loadingOverlay;

// ============================================
// メイン処理: 状態更新
// ============================================
async function updateStatus() {
  try {
    const response = await axios.get('/api/status');
    const data = response.data;
    
    // セッション変更検知 → 投票フラグをリセット
    if (currentSessionId !== null && data.sessionId !== currentSessionId) {
      resetVoteState();
    }
    
    // 状態更新
    currentSessionId = data.sessionId;
    currentVoteCount = data.votes[judgeNumber] || 0;
    hasVoted = data.votedStatus ? data.votedStatus[judgeNumber] : false;
    
    // 表示更新
    if (currentVoteCountElement) {
      currentVoteCountElement.textContent = currentVoteCount;
    }
    updateButtonStates();
    
  } catch (error) {
    console.error('ステータス取得エラー:', error);
  }
}

// ============================================
// 投票状態リセット
// ============================================
function resetVoteState() {
  hasVoted = false;
  currentVoteCount = 0;
  isProcessing = false;
}

// ============================================
// ボタン状態更新
// ============================================
function updateButtonStates() {
  if (!vote0Btn || !vote1Btn || !vote2Btn || !vote3Btn) return;
  
  const shouldDisable = hasVoted || isProcessing;
  const buttons = [vote0Btn, vote1Btn, vote2Btn, vote3Btn];
  
  buttons.forEach(btn => {
    btn.disabled = shouldDisable;
    
    if (shouldDisable) {
      btn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  });
}

// ============================================
// 投票処理
// ============================================
async function voteMultiple(count) {
  // 投票済みチェック
  if (hasVoted) {
    showFeedback('既に投票済みです', 'error');
    return;
  }
  
  // 処理中チェック
  if (isProcessing) return;
  
  try {
    isProcessing = true;
    showLoadingOverlay(true);
    updateButtonStates();
    
    // API呼び出し
    const response = await axios.post('/api/vote', {
      judgeNumber: judgeNumber,
      voteCount: count
    });
    
    if (!response.data.success) {
      throw new Error(response.data.error || '投票に失敗しました');
    }
    
    // 投票成功
    hasVoted = true;
    showLoadingOverlay(false);
    showFeedback(`${count}票投票しました！\n投票完了です`, 'success');
    await updateStatus();
    
  } catch (error) {
    console.error('投票エラー:', error);
    showLoadingOverlay(false);
    showFeedback(error.response?.data?.error || '投票に失敗しました', 'error');
    isProcessing = false;
    updateButtonStates();
  } finally {
    isProcessing = false;
  }
}

// ============================================
// YO〜送信処理
// ============================================
async function sendYo() {
  if (isProcessing) return;
  
  try {
    isProcessing = true;
    await axios.post('/api/yo', { judgeNumber: judgeNumber });
  } catch (error) {
    console.error('YO送信エラー:', error);
  } finally {
    setTimeout(() => { isProcessing = false; }, 1000);
  }
}

// ============================================
// UI制御: ローディングオーバーレイ
// ============================================
function showLoadingOverlay(show) {
  if (!loadingOverlay) return;
  
  if (show) {
    loadingOverlay.classList.remove('hidden');
  } else {
    loadingOverlay.classList.add('hidden');
  }
}

// ============================================
// UI制御: フィードバック表示
// ============================================
function showFeedback(message, type = 'info') {
  if (!feedback || !feedbackText) return;
  
  feedbackText.textContent = message;
  
  // カラー設定
  const colorMap = {
    success: 'text-xl font-bold text-green-600',
    error: 'text-xl font-bold text-red-600',
    info: 'text-xl font-bold text-gray-800'
  };
  feedbackText.className = colorMap[type] || colorMap.info;
  
  // 表示
  feedback.classList.remove('hidden');
  setTimeout(() => feedback.classList.add('hidden'), 3000);
}

// ============================================
// 初期化
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  // DOM要素取得
  vote0Btn = document.getElementById('vote0Btn');
  vote1Btn = document.getElementById('vote1Btn');
  vote2Btn = document.getElementById('vote2Btn');
  vote3Btn = document.getElementById('vote3Btn');
  yoBtn = document.getElementById('yoBtn');
  currentVoteCountElement = document.getElementById('currentVoteCount');
  feedback = document.getElementById('feedback');
  feedbackText = document.getElementById('feedbackText');
  loadingOverlay = document.getElementById('loadingOverlay');
  
  // 必須要素チェック
  if (!vote0Btn || !vote1Btn || !vote2Btn || !vote3Btn || !yoBtn) {
    console.error('必要な要素が見つかりません');
    return;
  }
  
  // イベントリスナー設定
  vote0Btn.addEventListener('click', () => voteMultiple(0));
  vote1Btn.addEventListener('click', () => voteMultiple(1));
  vote2Btn.addEventListener('click', () => voteMultiple(2));
  vote3Btn.addEventListener('click', () => voteMultiple(3));
  yoBtn.addEventListener('click', sendYo);
  
  // 初期化と定期更新
  updateStatus();
  setInterval(updateStatus, 3000);
});
