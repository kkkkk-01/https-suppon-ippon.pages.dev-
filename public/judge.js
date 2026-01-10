// 審査員用JavaScriptロジック
let currentVoteCount = 0;
let hasVoted = false;  // 投票済みフラグ
let isProcessing = false;  // 処理中フラグ（連続タップ防止）
let currentSessionId = null;  // 現在のセッションIDを追跡

// 状態を更新
async function updateStatus() {
  try {
    const response = await axios.get('/api/status');
    const data = response.data;
    
    console.log('updateStatus呼び出し - sessionId:', data.sessionId, 'currentSessionId:', currentSessionId, 'votes:', data.votes[judgeNumber]);
    
    // セッションIDが変わった場合（リセットされた場合）、投票フラグをクリア
    if (currentSessionId !== null && data.sessionId !== currentSessionId) {
      console.log('セッションがリセットされました:', currentSessionId, '->', data.sessionId);
      hasVoted = false;
      currentVoteCount = 0;
      isProcessing = false;  // 処理中フラグもクリア
    }
    
    // セッションIDを更新
    currentSessionId = data.sessionId;
    
    // 自分の投票数を取得
    currentVoteCount = data.votes[judgeNumber] || 0;
    document.getElementById('currentVoteCount').textContent = currentVoteCount;
    
    // 投票数が0なら投票可能、0より大きければ投票済み
    if (currentVoteCount === 0) {
      hasVoted = false;
    } else {
      hasVoted = true;
    }
    
    console.log('updateStatus完了 - hasVoted:', hasVoted, 'currentVoteCount:', currentVoteCount, 'isProcessing:', isProcessing);
    
    // ボタンの有効/無効を更新
    updateButtonStates();
  } catch (error) {
    console.error('ステータス取得エラー:', error);
  }
}

// ボタンの状態を更新
function updateButtonStates() {
  const vote1Btn = document.getElementById('vote1Btn');
  const vote2Btn = document.getElementById('vote2Btn');
  const vote3Btn = document.getElementById('vote3Btn');
  
  if (!vote1Btn || !vote2Btn || !vote3Btn) {
    console.error('投票ボタン要素が見つかりません');
    return;
  }
  
  console.log('updateButtonStates:', 'hasVoted:', hasVoted, 'isProcessing:', isProcessing, 'currentVoteCount:', currentVoteCount);
  
  // 既に投票済み、または処理中の場合はすべてのボタンを無効化
  if (hasVoted || isProcessing) {
    console.log('ボタンを無効化');
    vote1Btn.disabled = true;
    vote1Btn.classList.add('opacity-50', 'cursor-not-allowed');
    vote2Btn.disabled = true;
    vote2Btn.classList.add('opacity-50', 'cursor-not-allowed');
    vote3Btn.disabled = true;
    vote3Btn.classList.add('opacity-50', 'cursor-not-allowed');
    return;
  }
  
  // 未投票の場合、すべてのボタンを有効化
  console.log('ボタンを有効化');
  vote1Btn.disabled = false;
  vote1Btn.classList.remove('opacity-50', 'cursor-not-allowed');
  vote2Btn.disabled = false;
  vote2Btn.classList.remove('opacity-50', 'cursor-not-allowed');
  vote3Btn.disabled = false;
  vote3Btn.classList.remove('opacity-50', 'cursor-not-allowed');
}

// 投票処理（一括投票）
async function voteMultiple(count) {
  console.log('=== voteMultiple呼び出し ===');
  console.log('count:', count);
  console.log('hasVoted:', hasVoted, 'type:', typeof hasVoted);
  console.log('isProcessing:', isProcessing, 'type:', typeof isProcessing);
  console.log('judgeNumber:', judgeNumber);
  console.log('===============================');
  
  // 変数が未定義の場合はエラー表示
  if (typeof hasVoted === 'undefined' || typeof isProcessing === 'undefined') {
    console.error('致命的エラー: 変数が未初期化です');
    alert('システムエラーが発生しました。ページをリロードしてください。');
    return;
  }
  
  // 既に投票済みの場合は何もしない
  if (hasVoted === true) {
    console.log('投票済みのため処理をスキップ');
    showFeedback('既に投票済みです', 'error');
    return;
  }
  
  // 処理中の場合は何もしない（連続タップ防止）
  if (isProcessing === true) {
    console.log('処理中のため処理をスキップ');
    return;
  }
  
  console.log('投票処理を開始します');
  
  try {
    // 処理中フラグを立てる
    isProcessing = true;
    showLoadingOverlay(true);  // ローディング表示
    updateButtonStates();  // ボタンを即座に無効化
    
    // 連続で投票APIを呼び出す
    for (let i = 0; i < count; i++) {
      const response = await axios.post('/api/vote', {
        judgeNumber: judgeNumber
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || '投票に失敗しました');
      }
    }
    
    // 投票済みフラグを立てる
    hasVoted = true;
    
    // ローディング非表示
    showLoadingOverlay(false);
    
    // 成功フィードバック
    showFeedback(`${count}票投票しました！\n投票完了です`, 'success');
    
    // 画面を緑色にフラッシュ
    document.body.classList.add('success-flash');
    setTimeout(() => document.body.classList.remove('success-flash'), 500);
    
    // ステータスを更新
    await updateStatus();
  } catch (error) {
    console.error('投票エラー:', error);
    showLoadingOverlay(false);  // ローディング非表示
    showFeedback(error.response?.data?.error || '投票に失敗しました', 'error');
    // エラーの場合は処理中フラグを解除
    isProcessing = false;
    updateButtonStates();
  } finally {
    // 処理完了
    isProcessing = false;
  }
}

// YO〜送信
async function sendYo() {
  // 処理中の場合は何もしない（連続タップ防止）
  if (isProcessing) {
    return;
  }
  
  try {
    // 処理中フラグを立てる
    isProcessing = true;
    
    const response = await axios.post('/api/yo', {
      judgeNumber: judgeNumber
    });
    
    if (response.data.success) {
      // 通知を削除（軽量化のため）
      // ボタンをアニメーション
      const yoBtn = document.getElementById('yoBtn');
      yoBtn.classList.add('pulse-scale');
      setTimeout(() => yoBtn.classList.remove('pulse-scale'), 2000);
    }
  } catch (error) {
    console.error('YO送信エラー:', error);
  } finally {
    // 処理完了（1秒後に解除）
    setTimeout(() => {
      isProcessing = false;
    }, 1000);
  }
}

// ローディングオーバーレイの表示/非表示
function showLoadingOverlay(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    console.error('loadingOverlay 要素が見つかりません');
    return;
  }
  if (show) {
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

// フィードバック表示
function showFeedback(message, type = 'info') {
  const feedback = document.getElementById('feedback');
  const feedbackText = document.getElementById('feedbackText');
  
  if (!feedback || !feedbackText) {
    console.error('feedback 要素が見つかりません');
    return;
  }
  
  feedbackText.textContent = message;
  
  // 色を設定
  if (type === 'success') {
    feedbackText.className = 'text-xl font-bold text-green-600';
  } else if (type === 'error') {
    feedbackText.className = 'text-xl font-bold text-red-600';
  } else {
    feedbackText.className = 'text-xl font-bold text-gray-800';
  }
  
  feedback.classList.remove('hidden');
  
  // 3秒後に非表示
  setTimeout(() => {
    feedback.classList.add('hidden');
  }, 3000);
}

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM読み込み完了 - 初期化を開始します');
  
  // イベントリスナー設定
  const vote1Btn = document.getElementById('vote1Btn');
  const vote2Btn = document.getElementById('vote2Btn');
  const vote3Btn = document.getElementById('vote3Btn');
  const yoBtn = document.getElementById('yoBtn');
  
  if (!vote1Btn || !vote2Btn || !vote3Btn || !yoBtn) {
    console.error('必要な要素が見つかりません');
    return;
  }
  
  vote1Btn.addEventListener('click', () => voteMultiple(1));
  vote2Btn.addEventListener('click', () => voteMultiple(2));
  vote3Btn.addEventListener('click', () => voteMultiple(3));
  yoBtn.addEventListener('click', sendYo);
  
  console.log('イベントリスナー設定完了');
  
  // 初回読み込み
  updateStatus();
  
  // 定期的に状態を更新（3秒ごと）
  setInterval(updateStatus, 3000);
  
  console.log('初期化完了');
});
