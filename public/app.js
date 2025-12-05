(function(){
  // Only run on pages that have the challenge UI
  if (!document.getElementById('prompt')) return;

  const params = new URLSearchParams(location.search);
  const type = (params.get('type') || 'A').toUpperCase();
  const titleMap = { A:'A 千元找零', B:'B 10%服務費', C:'C 9折優惠', D:'D 買單加總' };
  document.getElementById('title').textContent = titleMap[type] || '挑戰';
  document.getElementById('backBtn').addEventListener('click', ()=> location.href = 'index.html');

  // 再來一次按鈕
  const retryBtn = document.getElementById('retryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      document.getElementById('result').textContent = '';
      document.getElementById('timer').textContent = '計時：0.000 秒';
      loadChallenge();
    });
  }

  let challenge = null;
  let timerInterval = null;
  const timerEl = document.getElementById('timer');

  function startLocalTimer(startTs) {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const ms = Date.now() - startTs;
      timerEl.textContent = '計時：' + (ms/1000).toFixed(3) + ' 秒';
    }, 50);
  }

  async function loadChallenge() {
    // disable input while loading
    const input = document.getElementById('answerInput');
    const submitBtn = document.querySelector('#answerForm button[type="submit"]');
    input.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    document.getElementById('prompt').textContent = '載入題目中...';
    document.getElementById('result').textContent = '';

    const r = await fetch(`/api/challenge?type=${type}`);
    if (!r.ok) { document.getElementById('prompt').textContent = '無法取得題目'; return; }
    challenge = await r.json();
    renderPrompt();
    // enable input and start local timer
    input.disabled = false;
    if (submitBtn) submitBtn.disabled = false;
    // focus input so user can type immediately
    try { input.focus(); input.select(); } catch (e) {}
    startLocalTimer(Date.now()); // local display; server uses its own start
  }

  function renderPrompt() {
    const el = document.getElementById('prompt');
    el.innerHTML = '';
    if (!challenge) return;
    const p = challenge.payload;
    if (challenge.type === 'A') {
      el.textContent = `商品價格 ${p.price} 元。付 1000 元，請問找零多少？`;
    } else if (challenge.type === 'B') {
      el.textContent = `餐費 ${p.price} 元。請問含 10% 服務費後總額為多少（四捨五入至整數）？`;
    } else if (challenge.type === 'C') {
      el.textContent = `商品價格 ${p.price} 元。請問 9 折後價格為多少（四捨五入至整數）？`;
    } else if (challenge.type === 'D') {
      const ul = document.createElement('div');
      ul.innerHTML = '<strong>請計算以下項目總額：</strong><br/>';
      p.items.forEach(it => {
        const row = document.createElement('div');
        row.textContent = `${it.name} x ${it.qty}（單價 ${it.unit}）`;
        ul.appendChild(row);
      });
      el.appendChild(ul);
    }
  }

  document.getElementById('answerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('answerInput');
    const val = Number(input.value);
    if (!Number.isInteger(val)) { alert('請輸入整數'); input.focus(); input.select(); return; }
    const res = await fetch('/api/answer', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id: challenge.id, answer: val })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || '提交錯誤'); return; }
    if (data.correct) {
      clearInterval(timerInterval);
      timerEl.textContent += ' （已停止）';
      document.getElementById('result').textContent = `答對！耗時 ${(data.elapsedMs/1000).toFixed(3)} 秒。正確答案：${data.correctAnswer}`;
      // disable input after correct
      document.getElementById('answerInput').disabled = true;
      const submitBtn = document.querySelector('#answerForm button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
    } else {
      document.getElementById('result').textContent = '答案錯誤，請再試一次。';
      // refocus for quick retry
      try { input.focus(); input.select(); } catch (e) {}
    }
    input.value = '';
    loadHistory();
  });

  async function loadHistory() {
    const r = await fetch('/api/history');
    if (!r.ok) return;
    const h = await r.json();
    const container = document.getElementById('historyList');
    container.innerHTML = '';
    if (!h.length) { container.textContent = '尚無紀錄'; return; }
    h.slice(0,20).forEach(it => {
      const div = document.createElement('div');
      div.className = 'history-item';
      const ok = it.correct ? '✅' : '❌';
      div.textContent = `[${new Date(it.timestamp).toLocaleTimeString()}] 類型 ${it.type} ${ok} 提交: ${it.answerSubmitted} 正確: ${it.correctAnswer} 耗時 ${(it.elapsedMs/1000).toFixed(3)}s`;
      container.appendChild(div);
    });
  }

  loadChallenge();
  loadHistory();
})();
