// PC集計画面のJavaScript
let currentSessionId = null;
let hasPlayedIppon = false;
let lastPlayedYoId = null; // 最後に再生したYO〜イベントのID
let previousVotes = {}; // 前回の投票状態を記録

// 音声要素
const ipponAudio = document.getElementById('ipponAudio');
const yoAudio = document.getElementById('yoAudio');

// 状態を更新
async function updateStatus() {
  try {
    const response = await axios.get('/api/status');
    const data = response.data;
    
    // セッションが変わったらIPPON再生フラグと前回の投票状態をリセット
    if (currentSessionId !== data.sessionId) {
      currentSessionId = data.sessionId;
      hasPlayedIppon = false;
      previousVotes = {}; // 前回の投票状態をクリア
    }
    
    // 投票カウントを更新
    document.getElementById('voteCount').textContent = data.voteCount;
    
    // 各審査員の状態を更新
    for (let i = 1; i <= 5; i++) {
      const judgeCard = document.getElementById(`judge-${i}`);
      const judgeName = document.getElementById(`judge-name-${i}`);
      const statusIcon = document.getElementById(`status-${i}`);
      const votedText = document.getElementById(`voted-text-${i}`);
      
      const voteCount = data.votes[i] || 0;
      const wasVoteCount = previousVotes[i] || 0;
      
      if (voteCount > 0) {
        // 投票済み - 赤く光るカードに変更
        // 投票数に応じて絵文字を変更
        if (voteCount === 1) {
          statusIcon.textContent = '🟡';
        } else if (voteCount === 2) {
          statusIcon.textContent = '🟠';
        } else if (voteCount >= 3) {
          statusIcon.textContent = '🔴';
        }
        
        votedText.textContent = `${voteCount}票 / 3票`;
        votedText.className = 'text-lg font-bold mt-2 text-white';
        judgeName.className = 'text-2xl font-bold mb-3 text-white';
        
        // 赤く光るアニメーションを追加
        judgeCard.classList.add('voted-card');
        judgeCard.classList.remove('bg-white/90', 'border-black');
        
        // 新規投票の場合、ポップアニメーションを追加
        if (voteCount > wasVoteCount) {
          judgeCard.classList.add('vote-pop');
          setTimeout(() => judgeCard.classList.remove('vote-pop'), 500);
        }
      } else {
        // 未投票 - 通常の白いカードに戻す
        statusIcon.textContent = '⚪️';
        votedText.textContent = '0票 / 3票';
        votedText.className = 'text-lg font-semibold mt-2 text-gray-600';
        judgeName.className = 'text-2xl font-bold mb-3 text-gray-900';
        
        // 赤く光るアニメーションを削除
        judgeCard.classList.remove('voted-card');
        judgeCard.classList.add('bg-white/90', 'border-black');
      }
    }
    
    // 現在の投票状態を記録
    previousVotes = { ...data.votes };
    
    // IPPONバナー表示
    const ipponBanner = document.getElementById('ipponBanner');
    const ipponContent = ipponBanner.firstElementChild;
    
    if (data.isIppon) {
      const wasHidden = ipponBanner.classList.contains('hidden');
      ipponBanner.classList.remove('hidden');
      
      // 新しくIPPONになった場合、登場アニメーションを追加
      if (wasHidden) {
        ipponContent.classList.add('ippon-appear');
        setTimeout(() => ipponContent.classList.remove('ippon-appear'), 500);
      }
      
      // IPPON音声を1回だけ再生
      if (!hasPlayedIppon) {
        hasPlayedIppon = true;
        ipponAudio.currentTime = 0;
        ipponAudio.play().catch(e => console.log('音声再生エラー:', e));
      }
    } else {
      ipponBanner.classList.add('hidden');
    }
    
  } catch (error) {
    console.error('ステータス取得エラー:', error);
  }
}

// YO〜イベントをチェック
async function checkYoEvent() {
  try {
    const response = await axios.get('/api/yo/latest');
    const data = response.data;
    
    // 新しいYO〜イベントがあり、まだ再生していない場合のみ再生
    if (data.hasYo && data.yoId !== lastPlayedYoId) {
      // YO〜音声を再生
      yoAudio.currentTime = 0;
      yoAudio.play().catch(e => console.log('YO音声再生エラー:', e));
      console.log(`YO〜! from ${data.judgeName} (ID: ${data.yoId})`);
      
      // 再生済みとしてIDを記録
      lastPlayedYoId = data.yoId;
    }
  } catch (error) {
    console.error('YO〜イベント取得エラー:', error);
  }
}

// リセットボタン
document.getElementById('resetBtn').addEventListener('click', async () => {
  try {
    await axios.post('/api/reset');
    hasPlayedIppon = false;
    previousVotes = {}; // 前回の投票状態をクリア
    await updateStatus();
  } catch (error) {
    console.error('リセットエラー:', error);
    alert('リセットに失敗しました');
  }
});

// 初回読み込み
updateStatus();

// 定期的に状態を更新（200ms間隔で高速化）
setInterval(updateStatus, 200);

// YO〜イベントをチェック（1秒間隔）
setInterval(checkYoEvent, 1000);

// ページロード時に音声を準備（ブラウザの自動再生ポリシー対応）
document.addEventListener('click', () => {
  ipponAudio.load();
  yoAudio.load();
}, { once: true });
