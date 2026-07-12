'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'habit-tracker:habits';

  let habits = loadFromStorage();

  const habitInput  = document.getElementById('habit-input');
  const addBtn      = document.getElementById('add-btn');
  const habitsList  = document.getElementById('habits-list');
  const overallStats = document.getElementById('overall-stats');
  const todayLabel  = document.getElementById('today-label');

  // Set up event listeners once
  addBtn.addEventListener('click', handleAdd);
  habitInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAdd();
  });
  habitsList.addEventListener('click', handleListClick);

  render();

  // ── Date utilities ─────────────────────────────

  function getToday() {
    return toDateStr(new Date());
  }

  function toDateStr(d) {
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function formatDateJa(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${y}年${m}月${d}日`;
  }

  /**
   * 当月のカレンダーグリッド用日付配列を返す。
   * 月初が何曜日かに応じて先頭に null パディングを入れ、
   * 行が 7 の倍数になるよう末尾にも null を補う。
   */
  function getGridDates() {
    const now        = new Date();
    const year       = now.getFullYear();
    const month      = now.getMonth();
    const firstDow   = new Date(year, month, 1).getDay();       // 月初の曜日 (0=日)
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // 月の日数
    const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;

    const dates = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDow + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        dates.push(null);
      } else {
        dates.push(toDateStr(new Date(year, month, dayNum)));
      }
    }
    return dates;
  }

  // ── Storage ────────────────────────────────────

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ── Habit operations ───────────────────────────

  function handleAdd() {
    const name = habitInput.value.trim();
    if (!name) {
      habitInput.focus();
      return;
    }
    habits.push({ id: generateId(), name, records: {} });
    saveToStorage();
    habitInput.value = '';
    render();
  }

  function deleteHabit(id) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    if (!confirm(`「${habit.name}」を削除しますか？\n記録もすべて消えます。`)) return;
    habits = habits.filter(h => h.id !== id);
    saveToStorage();
    render();
  }

  function toggleRecord(id, date) {
    if (date > getToday()) return;
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    if (habit.records[date]) {
      delete habit.records[date];
    } else {
      habit.records[date] = true;
    }
    saveToStorage();
    render();
  }

  // ── Statistics ─────────────────────────────────

  /**
   * Counts consecutive days ending at today (inclusive).
   * If today is not done, counts back from yesterday so an
   * unbroken streak still appears until the user forgets a day.
   */
  function calcStreak(habit) {
    const today = getToday();
    const d = new Date(today + 'T00:00:00');
    if (!habit.records[today]) {
      d.setDate(d.getDate() - 1);
    }
    let streak = 0;
    while (true) {
      const key = toDateStr(d);
      if (habit.records[key]) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function calcWeeklyRate(habit) {
    const base = new Date();
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      if (habit.records[toDateStr(d)]) done++;
    }
    return Math.round((done / 7) * 100);
  }

  function calcMonthlyRate(habit) {
    const today = new Date();
    const y     = today.getFullYear();
    const m     = today.getMonth() + 1;
    const days  = today.getDate(); // 月初から今日まで
    let done = 0;
    for (let i = 1; i <= days; i++) {
      const key = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      if (habit.records[key]) done++;
    }
    return Math.round((done / days) * 100);
  }

  function calc30DayRate(habit) {
    const base = new Date();
    let done = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      if (habit.records[toDateStr(d)]) done++;
    }
    return Math.round((done / 30) * 100);
  }

  // ── Rendering ──────────────────────────────────

  function render() {
    todayLabel.textContent = formatDateJa(getToday());
    renderOverallStats();
    renderHabits();
  }

  function renderOverallStats() {
    if (habits.length === 0) {
      overallStats.innerHTML = '';
      return;
    }
    const today      = getToday();
    const total      = habits.length;
    const doneToday  = habits.filter(h => h.records[today]).length;
    const avgWeekly  = Math.round(habits.reduce((s, h) => s + calcWeeklyRate(h), 0) / total);
    const avgMonthly = Math.round(habits.reduce((s, h) => s + calcMonthlyRate(h), 0) / total);
    const avg30Day   = Math.round(habits.reduce((s, h) => s + calc30DayRate(h), 0) / total);

    overallStats.innerHTML = `
      <div class="stats-card">
        <div class="stat-item">
          <div class="stat-value">${doneToday}<span class="stat-sub"> / ${total}</span></div>
          <div class="stat-label">今日の達成</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${avgWeekly}%</div>
          <div class="stat-label">今週の平均</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${avgMonthly}%</div>
          <div class="stat-label">今月の平均</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${avg30Day}%</div>
          <div class="stat-label">直近30日</div>
        </div>
      </div>
    `;
  }

  function renderHabits() {
    habitsList.innerHTML = '';

    if (habits.length === 0) {
      habitsList.innerHTML = '<p class="empty-message">習慣を追加してみましょう！</p>';
      return;
    }

    const today      = getToday();
    const gridDates  = getGridDates();
    const dayLabels  = ['日', '月', '火', '水', '木', '金', '土'];

    const labelsHTML = dayLabels
      .map(l => `<div class="day-label">${l}</div>`)
      .join('');

    habits.forEach(habit => {
      const streak      = calcStreak(habit);
      const weeklyRate  = calcWeeklyRate(habit);
      const monthlyRate = calcMonthlyRate(habit);
      const doneToday   = !!habit.records[today];

      const [todayY, todayM, todayD] = today.split('-');
      const todayLabel  = `${parseInt(todayM)}/${parseInt(todayD)}`;
      const monthHeader = `${todayY}年${parseInt(todayM)}月`;

      const gridHTML = gridDates.map(date => {
        if (date === null) {
          return `<div class="grid-cell empty-cell"></div>`;
        }
        const done     = !!habit.records[date];
        const isToday  = date === today;
        const isFuture = date > today;
        const cls = ['grid-cell', done && 'done', isToday && 'today', isFuture && 'future']
          .filter(Boolean).join(' ');
        const dayNum = parseInt(date.split('-')[2], 10);
        return `<div class="${cls}" data-id="${habit.id}" data-date="${date}" title="${date}"><span class="cell-day">${dayNum}</span></div>`;
      }).join('');

      const card = document.createElement('div');
      card.className = 'habit-card';
      card.innerHTML = `
        <div class="habit-header">
          <div class="habit-name">${escapeHtml(habit.name)}</div>
          <button class="delete-btn" data-id="${habit.id}" aria-label="削除">✕</button>
        </div>
        <div class="habit-meta">
          <span class="streak ${streak > 0 ? 'active' : ''}">🔥 ${streak}日連続</span>
          <span class="rate-badge">週 ${weeklyRate}%</span>
          <span class="rate-badge">月 ${monthlyRate}%</span>
        </div>
        <div class="grid-wrapper">
          <div class="grid-inner">
            <div class="grid-month-header">${monthHeader}</div>
            <div class="day-labels">${labelsHTML}</div>
            <div class="activity-grid">${gridHTML}</div>
          </div>
        </div>
        <button class="check-btn ${doneToday ? 'checked' : ''}" data-id="${habit.id}" data-date="${today}">
          ${doneToday ? `✓ 今日 (${todayLabel}) 達成済み` : `今日 (${todayLabel}) をチェック`}
        </button>
      `;

      habitsList.appendChild(card);
    });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Event delegation ───────────────────────────

  function handleListClick(e) {
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
      deleteHabit(deleteBtn.dataset.id);
      return;
    }

    const checkBtn = e.target.closest('.check-btn');
    if (checkBtn) {
      toggleRecord(checkBtn.dataset.id, checkBtn.dataset.date);
      return;
    }

    const cell = e.target.closest('.grid-cell');
    if (cell && !cell.classList.contains('future') && !cell.classList.contains('empty-cell')) {
      toggleRecord(cell.dataset.id, cell.dataset.date);
    }
  }
});
