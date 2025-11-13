(function () {
  const STORAGE_KEYS = {
    subjects: 'revision_subjects',
    settings: 'revision_settings',
    plan: 'revision_plan',
    tests: 'revision_tests',
    sessions: 'revision_sessions',
    pastPapers: 'revision_pastpapers'
  };

  const REVISION_METHODS = [
    'Reading notes',
    'Writing notes',
    'Blurting',
    'Flashcards',
    'Exam questions',
    'Mind maps',
    'Teaching someone',
    'Marking answers'
  ];

  const DIFFICULTY_WEIGHT = {
    Easy: 0.3,
    OK: 0.6,
    Hard: 1
  };

  const BASE_SUBJECTS = {
    biology: {
      name: 'Biology',
      topics: [
        {
          name: 'Biological Molecules',
          subtopics: ['Carbohydrates', 'Lipids', 'Proteins', 'Water', 'Inorganic ions', 'Nucleic acids', 'ATP']
        },
        {
          name: 'Cells',
          subtopics: ['Cell structure', 'Microscopy', 'Membranes', 'Transport', 'Cell cycle', 'Mitosis', 'Prokaryotes', 'Viruses', 'Immune response']
        },
        {
          name: 'Exchange',
          subtopics: ['Gas exchange', 'Digestion', 'Absorption', 'Mass transport (animals)', 'Mass transport (plants)']
        },
        {
          name: 'Genetic Information',
          subtopics: ['DNA', 'Protein synthesis', 'Genetic diversity', 'Natural selection']
        },
        {
          name: 'Energy Transfers',
          subtopics: ['Photosynthesis', 'Respiration', 'Ecosystems', 'Nutrient cycles']
        },
        {
          name: 'Responses',
          subtopics: ['Nervous system', 'Muscles', 'Homeostasis']
        },
        {
          name: 'Genetics & Evolution',
          subtopics: ['Inheritance', 'Populations', 'Evolution']
        },
        {
          name: 'Gene Expression',
          subtopics: ['Mutations', 'Regulation', 'Recombinant DNA']
        }
      ]
    },
    pe: {
      name: 'PE',
      topics: [
        {
          name: 'Applied anatomy & physiology',
          subtopics: ['Cardiovascular system', 'Respiratory system', 'Neuromuscular system', 'Energy systems']
        },
        {
          name: 'Skill acquisition',
          subtopics: ['Learning theories', 'Skill classification', 'Stages of learning', 'Guidance', 'Feedback']
        },
        {
          name: 'Sport & society',
          subtopics: ['Socialisation', 'Globalisation', 'Ethics', 'Violence', 'Drugs', 'Deviance']
        },
        {
          name: 'Exercise physiology',
          subtopics: ['Diet', 'Nutrition', 'Training methods', 'Injuries', 'Rehabilitation']
        },
        {
          name: 'Biomechanics',
          subtopics: ['Newton’s laws', 'Forces', 'Levers', 'Projectile motion']
        },
        {
          name: 'Sport psychology',
          subtopics: ['Motivation', 'Arousal', 'Anxiety', 'Aggression', 'Personality', 'Goal setting']
        },
        {
          name: 'Technology in sport',
          subtopics: ['Data', 'Equipment', 'Analysis', 'Safety', 'Regulations']
        }
      ]
    }
  };

  const state = {
    subjects: {},
    settings: {},
    plan: null,
    tests: [],
    sessions: [],
    pastPapers: []
  };

  let topicIndex = {};
  let subtopicIndex = {};
  let studyModal = null;
  let topicModal = null;
  let timerInterval = null;
  let timerSeconds = 0;
  let timerRunning = false;
  let activeTopicId = null;
  let activePlanEntryId = null;
  let methodsPrompt = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    loadState();
    buildTopicIndex();
    initNavToggle();
    initStudyModal();
    initTopicModal();
    trackMissedSessions();
    routePage();
  }

  function loadState() {
    state.settings = loadFromStorage(STORAGE_KEYS.settings, {
      dailyHours: 3,
      timerLength: 25,
      prioritiseTests: true,
      examDate: ''
    });

    state.subjects = loadFromStorage(STORAGE_KEYS.subjects, null);
    if (!state.subjects) {
      state.subjects = createDefaultSubjects();
      persist(STORAGE_KEYS.subjects, state.subjects);
    }

    state.plan = loadFromStorage(STORAGE_KEYS.plan, null);
    state.tests = loadFromStorage(STORAGE_KEYS.tests, []);
    state.sessions = loadFromStorage(STORAGE_KEYS.sessions, []);
    state.pastPapers = loadFromStorage(STORAGE_KEYS.pastPapers, []);
  }

  function createDefaultSubjects() {
    const subjects = {};
    Object.entries(BASE_SUBJECTS).forEach(([subjectId, subject]) => {
      subjects[subjectId] = {
        name: subject.name,
        topics: subject.topics.map((topic) => ({
          id: `${subjectId}-${slug(topic.name)}`,
          name: topic.name,
          difficulty: 'OK',
          confidence: 0.6,
          lastStudied: null,
          missedSessions: 0,
          recentPerformance: 0.6,
          subtopics: topic.subtopics.map((sub) => ({
            id: `${subjectId}-${slug(topic.name)}-${slug(sub)}`,
            name: sub,
            completed: false,
            difficulty: 'OK',
            completionDate: '',
            confidence: 0.6,
            lastStudied: null,
            missedSessions: 0,
            recentPerformance: 0.6
          }))
        }))
      };
    });
    return subjects;
  }

  function buildTopicIndex() {
    topicIndex = {};
    subtopicIndex = {};
    let mutated = false;
    Object.entries(state.subjects).forEach(([subjectId, subject]) => {
      subject.topics.forEach((topic) => {
        if (typeof topic.confidence !== 'number') { topic.confidence = 0.6; mutated = true; }
        if (typeof topic.recentPerformance !== 'number') { topic.recentPerformance = 0.6; mutated = true; }
        if (typeof topic.missedSessions !== 'number') { topic.missedSessions = 0; mutated = true; }
        topicIndex[topic.id] = {
          subjectId,
          subjectName: subject.name,
          topic
        };
        topic.subtopics.forEach((subtopic) => {
          if (!('lastStudied' in subtopic)) { subtopic.lastStudied = null; mutated = true; }
          if (typeof subtopic.confidence !== 'number') { subtopic.confidence = 0.6; mutated = true; }
          if (typeof subtopic.recentPerformance !== 'number') { subtopic.recentPerformance = 0.6; mutated = true; }
          if (typeof subtopic.missedSessions !== 'number') { subtopic.missedSessions = 0; mutated = true; }
          subtopicIndex[subtopic.id] = {
            subjectId,
            subjectName: subject.name,
            topic,
            subtopic
          };
        });
      });
    });
    if (mutated) {
      persist(STORAGE_KEYS.subjects, state.subjects);
    }
  }

  function resolveStudyItem(id) {
    if (!id) return null;
    if (subtopicIndex[id]) {
      return { type: 'subtopic', ...subtopicIndex[id] };
    }
    if (topicIndex[id]) {
      return { type: 'topic', ...topicIndex[id] };
    }
    return null;
  }

  function formatStudyItemName(info) {
    if (!info) return '';
    if (info.type === 'subtopic') {
      return `${info.topic.name} — ${info.subtopic.name}`;
    }
    return info.topic.name;
  }

  function initNavToggle() {
    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('navLinks');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        nav.classList.toggle('open');
      });
    }
  }

  function routePage() {
    const page = document.body.dataset.page;
    highlightActiveNav();
    switch (page) {
      case 'home':
        renderHome();
        break;
      case 'planner':
        renderPlanner();
        break;
      case 'biology':
        renderSubjectPage('biology', 'biologyTopicList');
        break;
      case 'pe':
        renderSubjectPage('pe', 'peTopicList');
        break;
      case 'progress':
        renderProgress();
        break;
      case 'pastpapers':
        renderPastPapers();
        break;
      case 'settings':
        renderSettings();
        break;
      default:
        break;
    }
  }

  function highlightActiveNav() {
    const page = document.body.dataset.page;
    const nav = document.getElementById('navLinks');
    if (!nav) return;
    nav.querySelectorAll('a').forEach((link) => {
      const target = link.dataset.page || '';
      link.classList.toggle('active', target === page);
    });
  }

  function renderHome() {
    populateTopicSelect('homeTopicSelect');
    renderTodayList('homeTodayList');
    renderUpcomingTests('homeTests');
    renderHomeInsights();
    updatePredictedGrade('predictedGrade');

    const startBtn = document.getElementById('homeStartStudy');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const select = document.getElementById('homeTopicSelect');
        if (!select || !select.value) return;
        openStudyMode(select.value);
      });
    }
  }

  function renderPlanner() {
    const hoursInput = document.getElementById('plannerHours');
    const testToggle = document.getElementById('plannerTestPriority');
    if (hoursInput) hoursInput.value = state.settings.dailyHours;
    if (testToggle) testToggle.checked = state.settings.prioritiseTests;

    const generateBtn = document.getElementById('generatePlan');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        const hours = parseFloat(hoursInput.value) || state.settings.dailyHours;
        const prioritise = testToggle.checked;
        state.settings.dailyHours = hours;
        state.settings.prioritiseTests = prioritise;
        persist(STORAGE_KEYS.settings, state.settings);
        generateAdaptivePlan(hours, prioritise);
        renderTodayList('plannerToday');
        renderWeeklySchedule();
      });
    }

    renderTodayList('plannerToday');
    renderWeeklySchedule();
    setupTestForm();
  }

  function renderSubjectPage(subjectId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const subject = state.subjects[subjectId];
    if (!subject) return;

    subject.topics.forEach((topic) => {
      const completion = computeSubtopicCompletion(topic);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'topic-card';
      card.dataset.topicId = topic.id;
      card.innerHTML = `
        <div class="topic-card__header">
          <h3>${topic.name}</h3>
          <span class="badge">${(completion * 100).toFixed(0)}% complete</span>
        </div>
        <p class="muted">Confidence ${(topic.confidence * 100).toFixed(0)}%</p>
      `;
      card.addEventListener('click', () => openTopicModal(topic.id));
      container.appendChild(card);
    });
  }

  function renderProgress() {
    const hours = document.getElementById('progressHours');
    const topicsEl = document.getElementById('progressTopics');
    const subtopicsEl = document.getElementById('progressSubtopics');
    const grade = document.getElementById('progressGrade');
    const streakValue = document.getElementById('streakValue');
    const streakBar = document.getElementById('streakBar');

    const totalMinutes = state.sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    if (hours) hours.textContent = `${(totalMinutes / 60).toFixed(1)}h`;

    const topicStats = countTopicCompletion();
    if (topicsEl) topicsEl.textContent = topicStats.completedTopics;
    if (subtopicsEl) subtopicsEl.textContent = topicStats.completedSubtopics;
    if (grade) grade.textContent = computePredictedGrade();

    renderMethodBreakdown();

    const streak = computeStreak();
    if (streakValue) streakValue.textContent = `${streak} day${streak === 1 ? '' : 's'}`;
    if (streakBar) streakBar.style.width = `${Math.min(100, streak * 10)}%`;
  }

  function renderPastPapers() {
    const form = document.getElementById('pastPaperForm');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const subject = form.querySelector('#paperSubject').value;
        const paperName = form.querySelector('#paperName').value.trim();
        const score = form.querySelector('#paperScore').value;
        if (!paperName) return;
        const paper = {
          id: `paper-${Date.now()}`,
          subject,
          name: paperName,
          score: score ? Number(score) : null,
          completed: false,
          added: new Date().toISOString()
        };
        state.pastPapers.push(paper);
        persist(STORAGE_KEYS.pastPapers, state.pastPapers);
        form.reset();
        renderPastPaperLists();
      });
    }
    renderPastPaperLists();
  }

  function renderSettings() {
    const form = document.getElementById('settingsForm');
    if (!form) return;
    form.querySelector('#settingsHours').value = state.settings.dailyHours;
    form.querySelector('#settingsTimer').value = state.settings.timerLength;
    form.querySelector('#settingsPriority').checked = !!state.settings.prioritiseTests;
    form.querySelector('#settingsExamDate').value = state.settings.examDate || '';

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      state.settings.dailyHours = parseFloat(form.querySelector('#settingsHours').value) || state.settings.dailyHours;
      state.settings.timerLength = parseInt(form.querySelector('#settingsTimer').value, 10) || state.settings.timerLength;
      state.settings.prioritiseTests = form.querySelector('#settingsPriority').checked;
      state.settings.examDate = form.querySelector('#settingsExamDate').value;
      persist(STORAGE_KEYS.settings, state.settings);
      alert('Settings saved.');
    });

    const clearBtn = document.getElementById('clearAll');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('This will remove all stored revision data. Continue?')) {
          Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
          window.location.reload();
        }
      });
    }
  }

  function populateTopicSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '';
    Object.entries(state.subjects).forEach(([subjectId, subject]) => {
      subject.topics.forEach((topic) => {
        const group = document.createElement('optgroup');
        group.label = `${subject.name} · ${topic.name}`;
        if (!topic.subtopics.length) {
          const option = document.createElement('option');
          option.value = topic.id;
          option.textContent = topic.name;
          group.appendChild(option);
        } else {
          topic.subtopics.forEach((subtopic) => {
            const option = document.createElement('option');
            option.value = subtopic.id;
            option.textContent = subtopic.name;
            group.appendChild(option);
          });
        }
        select.appendChild(group);
      });
    });
  }

  function renderTodayList(listId) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '';
    const today = formatDateKey(new Date());
    const todayPlan = state.plan?.days?.[today] || [];
    if (!todayPlan.length) {
      const empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = 'No sessions planned yet. Generate a plan to populate this list.';
      list.appendChild(empty);
      return;
    }

    todayPlan.forEach((entry) => {
      const info = resolveStudyItem(entry.topicId);
      if (!info) return;
      const item = document.createElement('li');
      item.className = 'list-item';
      item.innerHTML = `
        <div>
          <strong>${formatStudyItemName(info)}</strong>
          <span class="muted small">${info.subjectName ? `${info.subjectName} · ` : ''}${entry.duration} mins${entry.isTestPrep ? ' · Test prep' : ''}</span>
        </div>
        <button class="link" type="button">Open</button>
      `;
      item.querySelector('button').addEventListener('click', () => openStudyMode(entry.topicId, entry.id));
      list.appendChild(item);
    });
  }

  function renderWeeklySchedule() {
    const container = document.getElementById('weeklySchedule');
    if (!container) return;
    container.innerHTML = '';
    if (!state.plan || !state.plan.days) {
      container.innerHTML = '<p class="muted">Generate a plan to see your upcoming week.</p>';
      return;
    }
    const sortedDays = Object.keys(state.plan.days).sort();
    sortedDays.forEach((dateKey) => {
      const dayContainer = document.createElement('div');
      dayContainer.className = 'day-column';
      const date = new Date(dateKey);
      const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      dayContainer.innerHTML = `<h3>${formatter.format(date)}</h3>`;
      const list = document.createElement('ul');
      list.className = 'simple-list';
      state.plan.days[dateKey].forEach((entry) => {
        const info = resolveStudyItem(entry.topicId);
        if (!info) return;
        const li = document.createElement('li');
        li.className = 'list-item';
        li.innerHTML = `
          <div>
            <strong>${formatStudyItemName(info)}</strong>
            <span class="muted small">${info.subjectName ? `${info.subjectName} · ` : ''}${entry.duration} mins${entry.isTestPrep ? ' · Test prep' : ''}</span>
          </div>
          <button class="link" type="button">Open</button>
        `;
        li.querySelector('button').addEventListener('click', () => openStudyMode(entry.topicId, entry.id));
        list.appendChild(li);
      });
      dayContainer.appendChild(list);
      container.appendChild(dayContainer);
    });
  }

  function setupTestForm() {
    const form = document.getElementById('testForm');
    const subjectSelect = document.getElementById('testSubject');
    const topicsSelect = document.getElementById('testTopics');
    if (!form || !subjectSelect || !topicsSelect) return;

    const populateTopics = () => {
      const subjectId = subjectSelect.value;
      topicsSelect.innerHTML = '';
      const subject = state.subjects[subjectId];
      if (!subject) return;
      subject.topics.forEach((topic) => {
        const option = document.createElement('option');
        option.value = topic.id;
        option.textContent = topic.name;
        topicsSelect.appendChild(option);
      });
    };

    subjectSelect.addEventListener('change', populateTopics);
    populateTopics();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = document.getElementById('testName').value.trim();
      const date = document.getElementById('testDate').value;
      const subject = subjectSelect.value;
      const topics = Array.from(topicsSelect.selectedOptions).map((opt) => opt.value);
      if (!name || !date || !topics.length) return;
      const test = {
        id: `test-${Date.now()}`,
        name,
        date,
        subject,
        topics,
        created: new Date().toISOString()
      };
      state.tests.push(test);
      persist(STORAGE_KEYS.tests, state.tests);
      form.reset();
      populateTopics();
      renderUpcomingTests('homeTests');
      renderTestsList();
    });

    renderTestsList();
  }

  function renderTestsList() {
    const list = document.getElementById('testsList');
    if (!list) return;
    list.innerHTML = '';
    if (!state.tests.length) {
      const empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = 'No topic tests scheduled.';
      list.appendChild(empty);
      return;
    }
    const sorted = [...state.tests].sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach((test) => {
      const li = document.createElement('li');
      const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
      const topics = test.topics.map((id) => topicIndex[id]?.topic.name || id).join(', ');
      li.innerHTML = `
        <div>
          <strong>${test.name}</strong>
          <span class="muted">${formatter.format(new Date(test.date))} · ${state.subjects[test.subject]?.name || ''}</span>
          <div class="muted small">${topics}</div>
        </div>
        <div class="actions">
          <button class="link" data-action="prep">Study</button>
          <button class="link danger" data-action="remove">Remove</button>
        </div>
      `;
      li.querySelector('[data-action="prep"]').addEventListener('click', () => {
        if (test.topics.length) {
          const primary = test.topics[0];
          const target = getPrioritySubtopicId(primary) || primary;
          openStudyMode(target);
        }
      });
      li.querySelector('[data-action="remove"]').addEventListener('click', () => {
        state.tests = state.tests.filter((t) => t.id !== test.id);
        persist(STORAGE_KEYS.tests, state.tests);
        renderTestsList();
        renderUpcomingTests('homeTests');
      });
      list.appendChild(li);
    });
  }

  function renderUpcomingTests(listId) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '';
    if (!state.tests.length) {
      const empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = 'No upcoming tests.';
      list.appendChild(empty);
      return;
    }
    const sorted = [...state.tests]
      .filter((test) => new Date(test.date) >= startOfDay(new Date()))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
    sorted.forEach((test) => {
      const li = document.createElement('li');
      const days = Math.max(0, Math.ceil((new Date(test.date) - new Date()) / (1000 * 60 * 60 * 24)));
      const topics = test.topics
        .map((id) => topicIndex[id]?.topic.name)
        .filter(Boolean)
        .join(', ');
      li.innerHTML = `
        <div>
          <strong>${test.name}</strong>
          ${topics ? `<div class="muted small">${topics}</div>` : ''}
        </div>
        <span class="muted">${days} day${days === 1 ? '' : 's'} left</span>
      `;
      list.appendChild(li);
    });
  }

  function renderHomeInsights() {
    const hoursEl = document.getElementById('homeHours');
    const subtopicsEl = document.getElementById('homeSubtopics');
    const methodsEl = document.getElementById('homeMethods');

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyMinutes = state.sessions
      .filter((session) => new Date(session.completedAt) >= weekAgo)
      .reduce((sum, session) => sum + (session.duration || 0), 0);
    if (hoursEl) hoursEl.textContent = `${(weeklyMinutes / 60).toFixed(1)}h`;

    const stats = countTopicCompletion();
    if (subtopicsEl) subtopicsEl.textContent = stats.completedSubtopics;

    if (methodsEl) {
      const methodsCount = {};
      state.sessions.forEach((session) => {
        (session.methods || []).forEach((method) => {
          methodsCount[method] = (methodsCount[method] || 0) + 1;
        });
      });
      const favourite = Object.entries(methodsCount).sort((a, b) => b[1] - a[1])[0];
      methodsEl.textContent = favourite ? `${favourite[0]} (${favourite[1]})` : 'Try logging a session';
    }
  }

  function updatePredictedGrade(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const grade = computePredictedGrade();
    el.textContent = `Predicted Grade: ${grade}`;
  }

  function computePredictedGrade() {
    const { completedSubtopics, totalSubtopics } = countTopicCompletion();
    if (!totalSubtopics) return 'N/A';
    const completionRate = completedSubtopics / totalSubtopics;
    if (completionRate >= 0.85) return 'A*';
    if (completionRate >= 0.7) return 'A';
    if (completionRate >= 0.55) return 'B';
    if (completionRate >= 0.4) return 'C';
    if (completionRate >= 0.25) return 'D';
    return 'E';
  }

  function renderMethodBreakdown() {
    const container = document.getElementById('methodBreakdown');
    if (!container) return;
    container.innerHTML = '';
    const counts = {};
    state.sessions.forEach((session) => {
      (session.methods || []).forEach((method) => {
        counts[method] = (counts[method] || 0) + 1;
      });
    });
    if (!Object.keys(counts).length) {
      container.innerHTML = '<p class="muted">Log a study session to see method insights.</p>';
      return;
    }
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([method, total]) => {
        const row = document.createElement('div');
        row.className = 'method-row';
        row.innerHTML = `
          <span>${method}</span>
          <div class="method-bar"><span style="width:${Math.min(100, total * 20)}%"></span></div>
          <span class="count">${total}</span>
        `;
        container.appendChild(row);
      });
  }

  function renderPastPaperLists() {
    const biologyList = document.getElementById('biologyPapers');
    const peList = document.getElementById('pePapers');
    if (biologyList) populatePaperList(biologyList, 'biology');
    if (peList) populatePaperList(peList, 'pe');
  }

  function populatePaperList(list, subjectId) {
    list.innerHTML = '';
    const papers = state.pastPapers.filter((paper) => paper.subject === subjectId);
    if (!papers.length) {
      const empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = 'No papers logged yet.';
      list.appendChild(empty);
      return;
    }
    papers
      .sort((a, b) => new Date(b.added) - new Date(a.added))
      .forEach((paper) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <div>
            <strong>${paper.name}</strong>
            <span class="muted">${paper.score != null ? `${paper.score}%` : 'Score not recorded'}</span>
          </div>
          <div class="actions">
            <label class="toggle small">
              <input type="checkbox" ${paper.completed ? 'checked' : ''}>
              <span>${paper.completed ? 'Done' : 'Mark complete'}</span>
            </label>
            <button class="link danger" type="button">Remove</button>
          </div>
        `;
        const checkbox = li.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
          paper.completed = checkbox.checked;
          persist(STORAGE_KEYS.pastPapers, state.pastPapers);
        });
        li.querySelector('button').addEventListener('click', () => {
          state.pastPapers = state.pastPapers.filter((p) => p.id !== paper.id);
          persist(STORAGE_KEYS.pastPapers, state.pastPapers);
          renderPastPaperLists();
        });
        list.appendChild(li);
      });
  }

  function generateAdaptivePlan(dailyHours, prioritiseTests) {
    const blockMinutes = 45;
    const blocksPerDay = Math.max(1, Math.round((dailyHours * 60) / blockMinutes));
    const today = startOfDay(new Date());
    const plan = {
      generatedAt: new Date().toISOString(),
      days: {}
    };

    const subtopics = getSubtopicScores(prioritiseTests);

    for (let i = 0; i < 7; i += 1) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateKey = formatDateKey(date);
      plan.days[dateKey] = [];
      for (let block = 0; block < blocksPerDay; block += 1) {
        subtopics.sort((a, b) => b.score - a.score);
        const chosen = subtopics[0];
        if (!chosen || chosen.score <= 0) break;
        plan.days[dateKey].push({
          id: `plan-${dateKey}-${block}`,
          topicId: chosen.subtopic.id,
          parentTopicId: chosen.topic.id,
          duration: blockMinutes,
          isTestPrep: false,
          completed: false
        });
        chosen.score *= 0.6;
      }
    }

    if (prioritiseTests) {
      const upcoming = state.tests.filter((test) => {
        const diff = differenceInDays(new Date(test.date), today);
        return diff >= 0 && diff <= 14;
      });
      upcoming.forEach((test) => {
        const diff = Math.max(0, differenceInDays(new Date(test.date), today) - 1);
        const targetIndex = Math.min(6, diff);
        const date = new Date(today);
        date.setDate(date.getDate() + targetIndex);
        const dateKey = formatDateKey(date);
        if (!plan.days[dateKey]) plan.days[dateKey] = [];
        test.topics.forEach((topicId, idx) => {
          const topicInfo = topicIndex[topicId];
          if (!topicInfo) return;
          const selections = selectTestSubtopics(topicInfo.topic, prioritiseTests, 3);
          selections.forEach((subSelection, subIdx) => {
            plan.days[dateKey].push({
              id: `test-${test.id}-${idx}-${subIdx}`,
              topicId: subSelection.subtopic.id,
              parentTopicId: topicInfo.topic.id,
              duration: 30,
              isTestPrep: true,
              completed: false
            });
          });
        });
      });
    }

    state.plan = plan;
    persist(STORAGE_KEYS.plan, state.plan);
  }

  function getSubtopicScores(prioritiseTests) {
    const today = startOfDay(new Date());
    const results = [];
    Object.values(topicIndex).forEach((info) => {
      info.topic.subtopics.forEach((subtopic) => {
        const score = calculateSubtopicScore(info.topic, subtopic, today, prioritiseTests);
        results.push({
          subjectId: info.subjectId,
          topic: info.topic,
          subtopic,
          score
        });
      });
    });
    return results;
  }

  function calculateSubtopicScore(topic, subtopic, today, prioritiseTests) {
    const completion = subtopic.completed ? 1 : 0;
    const difficulty = DIFFICULTY_WEIGHT[subtopic.difficulty] || 0.6;
    const subLast = subtopic.lastStudied ? startOfDay(new Date(subtopic.lastStudied)) : null;
    const topicLast = topic.lastStudied ? startOfDay(new Date(topic.lastStudied)) : null;
    const daysSince = subLast
      ? Math.max(0, differenceInDays(today, subLast))
      : topicLast
        ? Math.max(0, differenceInDays(today, topicLast)) + 2
        : 14;
    const confidence = subtopic.confidence ?? topic.confidence ?? 0.6;
    const missedWeight = (subtopic.missedSessions || 0) * 0.4 + (topic.missedSessions || 0) * 0.2;
    const performance = subtopic.recentPerformance ?? topic.recentPerformance ?? 0.6;
    const parentCompletion = computeSubtopicCompletion(topic);
    const testWeight = state.tests.reduce((sum, test) => {
      if (!test.topics.includes(topic.id)) return sum;
      const diff = differenceInDays(new Date(test.date), today);
      if (diff < 0) return sum;
      const proximity = Math.max(0, (14 - diff) / 14);
      const multiplier = prioritiseTests || state.settings.prioritiseTests ? 3 : 1.5;
      return sum + proximity * multiplier;
    }, 0);
    return (daysSince * 0.35)
      + (difficulty * 2)
      + testWeight
      + ((1 - confidence) * 1.3)
      + (1 - completion)
      + missedWeight
      + ((1 - performance) * 1.1)
      + ((1 - parentCompletion) * 0.5);
  }

  function selectTestSubtopics(topic, prioritiseTests, limit = 3) {
    if (!topic.subtopics.length) return [];
    const today = startOfDay(new Date());
    return [...topic.subtopics]
      .map((subtopic) => ({
        subtopic,
        score: calculateSubtopicScore(topic, subtopic, today, prioritiseTests) + (subtopic.completed ? -0.2 : 0)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(limit, topic.subtopics.length));
  }

  function getPrioritySubtopicId(topicId) {
    const info = topicIndex[topicId];
    if (!info) return null;
    const [top] = selectTestSubtopics(info.topic, state.settings.prioritiseTests, 1);
    return top?.subtopic.id || null;
  }

  function computeSubtopicCompletion(topic) {
    if (!topic.subtopics.length) return 0;
    const complete = topic.subtopics.filter((sub) => sub.completed).length;
    return complete / topic.subtopics.length;
  }

  function countTopicCompletion() {
    let completedTopics = 0;
    let completedSubtopics = 0;
    let totalSubtopics = 0;
    Object.values(state.subjects).forEach((subject) => {
      subject.topics.forEach((topic) => {
        const completion = computeSubtopicCompletion(topic);
        totalSubtopics += topic.subtopics.length;
        completedSubtopics += topic.subtopics.filter((sub) => sub.completed).length;
        if (completion === 1) {
          completedTopics += 1;
        }
      });
    });
    return { completedTopics, completedSubtopics, totalSubtopics };
  }

  function computeStreak() {
    if (!state.sessions.length) return 0;
    const sorted = [...state.sessions].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    let streak = 0;
    let currentDate = startOfDay(new Date());
    for (const session of sorted) {
      const sessionDate = startOfDay(new Date(session.completedAt));
      const diff = differenceInDays(currentDate, sessionDate);
      if (diff === 0) {
        streak += 1;
      } else if (diff === 1) {
        streak += 1;
        currentDate = sessionDate;
      } else if (diff > 1) {
        break;
      }
    }
    return streak;
  }

  function initStudyModal() {
    if (studyModal) return;
    studyModal = document.createElement('div');
    studyModal.id = 'studyModal';
    studyModal.className = 'modal-overlay';
    studyModal.innerHTML = `
      <div class="modal-card">
        <button class="modal-close" type="button" id="closeStudyModal">×</button>
        <h2 id="studyTopicName">Study Mode</h2>
        <div class="timer" id="timerDisplay">25:00</div>
        <div class="timer-controls">
          <button class="primary" id="timerStart">Start</button>
          <button class="secondary" id="timerPause">Pause</button>
          <button class="secondary" id="timerReset">Reset</button>
        </div>
        <button class="link" id="helpToggle" type="button">Revision method ideas</button>
        <div class="help-panel" id="helpPanel">
          <ul>
            ${REVISION_METHODS.map((method) => `<li>${method}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
    document.body.appendChild(studyModal);

    document.getElementById('closeStudyModal').addEventListener('click', closeStudyMode);
    document.getElementById('timerStart').addEventListener('click', startTimer);
    document.getElementById('timerPause').addEventListener('click', pauseTimer);
    document.getElementById('timerReset').addEventListener('click', resetTimer);
    document.getElementById('helpToggle').addEventListener('click', () => {
      document.getElementById('helpPanel').classList.toggle('open');
    });

    methodsPrompt = document.createElement('div');
    methodsPrompt.className = 'modal-overlay hidden';
    methodsPrompt.innerHTML = `
      <div class="modal-card">
        <h3>Session complete!</h3>
        <p>Select the revision methods you used.</p>
        <form id="methodsForm" class="methods-form"></form>
        <div class="actions">
          <button class="primary" id="methodsConfirm" type="button">Save session</button>
        </div>
      </div>
    `;
    document.body.appendChild(methodsPrompt);
    document.getElementById('methodsConfirm').addEventListener('click', submitMethods);
    populateMethodsForm();
  }

  function populateMethodsForm() {
    const form = document.getElementById('methodsForm');
    if (!form) return;
    form.innerHTML = '';
    REVISION_METHODS.forEach((method) => {
      const label = document.createElement('label');
      label.className = 'checkbox';
      label.innerHTML = `<input type="checkbox" value="${method}"> <span>${method}</span>`;
      form.appendChild(label);
    });
  }

  function initTopicModal() {
    if (topicModal) return;
    topicModal = document.createElement('div');
    topicModal.id = 'topicModal';
    topicModal.className = 'modal-overlay hidden';
    topicModal.innerHTML = `
      <div class="modal-card large">
        <button class="modal-close" type="button" id="closeTopicModal">×</button>
        <div id="topicModalBody"></div>
      </div>
    `;
    document.body.appendChild(topicModal);
    document.getElementById('closeTopicModal').addEventListener('click', closeTopicModal);
  }

  function openTopicModal(topicId) {
    const info = topicIndex[topicId];
    if (!info) return;
    const { topic, subjectName } = info;
    const body = document.getElementById('topicModalBody');
    const completion = computeSubtopicCompletion(topic);
    body.innerHTML = `
      <header class="topic-modal-header">
        <div>
          <p class="muted">${subjectName}</p>
          <h2>${topic.name}</h2>
        </div>
        <button class="primary" id="topicStart" type="button">Start Study Mode</button>
      </header>
      <div class="topic-stats">
        <div><span class="label">Completion</span><span class="value">${(completion * 100).toFixed(0)}%</span></div>
        <div><span class="label">Confidence</span><span class="value">${Math.round((topic.confidence || 0.5) * 100)}%</span></div>
        <div><span class="label">Last studied</span><span class="value">${topic.lastStudied ? new Intl.DateTimeFormat().format(new Date(topic.lastStudied)) : 'Not yet'}</span></div>
      </div>
      <div class="field-group">
        <label for="confidenceRange">Confidence level</label>
        <input type="range" min="0" max="1" step="0.1" id="confidenceRange" value="${topic.confidence || 0.6}">
      </div>
      <ul class="subtopic-list">
        ${topic.subtopics
          .map(
            (sub) => `
              <li data-subtopic="${sub.id}">
                <label class="checkbox">
                  <input type="checkbox" ${sub.completed ? 'checked' : ''}>
                  <span>${sub.name}</span>
                </label>
                <select class="subtopic-difficulty">
                  ${['Easy', 'OK', 'Hard']
                    .map((diff) => `<option value="${diff}" ${sub.difficulty === diff ? 'selected' : ''}>${diff}</option>`)
                    .join('')}
                </select>
                <input type="date" value="${sub.completionDate || ''}">
              </li>
            `
          )
          .join('')}
      </ul>
    `;

    body.querySelector('#topicStart').addEventListener('click', () => {
      closeTopicModal();
      const target = getPrioritySubtopicId(topic.id) || topic.id;
      openStudyMode(target);
    });

    const confidenceRange = body.querySelector('#confidenceRange');
    confidenceRange.addEventListener('input', () => {
      topic.confidence = parseFloat(confidenceRange.value);
      persist(STORAGE_KEYS.subjects, state.subjects);
      renderSubjectPage(info.subjectId, `${info.subjectId}TopicList`);
    });

    body.querySelectorAll('.subtopic-list li').forEach((row) => {
      const subId = row.dataset.subtopic;
      const subtopic = topic.subtopics.find((s) => s.id === subId);
      if (!subtopic) return;
      const checkbox = row.querySelector('input[type="checkbox"]');
      const select = row.querySelector('select');
      const dateInput = row.querySelector('input[type="date"]');

      checkbox.addEventListener('change', () => {
        subtopic.completed = checkbox.checked;
        if (checkbox.checked && !dateInput.value) {
          dateInput.valueAsDate = new Date();
        }
        if (!checkbox.checked) {
          subtopic.completionDate = '';
        }
        persist(STORAGE_KEYS.subjects, state.subjects);
        renderSubjectPage(info.subjectId, `${info.subjectId}TopicList`);
      });

      select.addEventListener('change', () => {
        subtopic.difficulty = select.value;
        persist(STORAGE_KEYS.subjects, state.subjects);
      });

      dateInput.addEventListener('change', () => {
        subtopic.completionDate = dateInput.value;
        subtopic.completed = !!dateInput.value;
        checkbox.checked = subtopic.completed;
        persist(STORAGE_KEYS.subjects, state.subjects);
        renderSubjectPage(info.subjectId, `${info.subjectId}TopicList`);
      });
    });

    topicModal.classList.remove('hidden');
  }

  function closeTopicModal() {
    topicModal?.classList.add('hidden');
  }

  function openStudyMode(topicId, planEntryId = null) {
    const info = resolveStudyItem(topicId);
    if (!info) return;
    activeTopicId = topicId;
    activePlanEntryId = planEntryId;
    const title = formatStudyItemName(info);
    document.getElementById('studyTopicName').textContent = title;
    resetTimer();
    studyModal.classList.add('open');
  }

  function closeStudyMode() {
    studyModal.classList.remove('open');
    pauseTimer();
  }

  function startTimer() {
    if (!activeTopicId) return;
    if (timerRunning) return;
    if (timerSeconds === 0) {
      timerSeconds = (state.settings.timerLength || 25) * 60;
      updateTimerDisplay();
    }
    timerRunning = true;
    timerInterval = setInterval(() => {
      timerSeconds -= 1;
      if (timerSeconds <= 0) {
        timerSeconds = 0;
        updateTimerDisplay();
        pauseTimer();
        showMethodsPrompt();
      } else {
        updateTimerDisplay();
      }
    }, 1000);
  }

  function pauseTimer() {
    timerRunning = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resetTimer() {
    pauseTimer();
    timerSeconds = (state.settings.timerLength || 25) * 60;
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const display = document.getElementById('timerDisplay');
    if (!display) return;
    const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    const seconds = String(timerSeconds % 60).padStart(2, '0');
    display.textContent = `${minutes}:${seconds}`;
  }

  function showMethodsPrompt() {
    populateMethodsForm();
    methodsPrompt.classList.remove('hidden');
    methodsPrompt.classList.add('open');
  }

  function submitMethods() {
    const form = document.getElementById('methodsForm');
    const methods = Array.from(form.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
    logStudySession(methods);
    methodsPrompt.classList.add('hidden');
    methodsPrompt.classList.remove('open');
    closeStudyMode();
    renderTodayList('homeTodayList');
    renderTodayList('plannerToday');
    renderWeeklySchedule();
    renderUpcomingTests('homeTests');
  }

  function logStudySession(methods) {
    if (!activeTopicId) return;
    const info = resolveStudyItem(activeTopicId);
    if (!info) return;
    const durationMinutes = (state.settings.timerLength || 25);
    const session = {
      id: `session-${Date.now()}`,
      topicId: activeTopicId,
      duration: durationMinutes,
      methods,
      completedAt: new Date().toISOString()
    };
    state.sessions.push(session);
    persist(STORAGE_KEYS.sessions, state.sessions);

    const topic = info.topic;
    const performanceBoost = methods.includes('Exam questions') ? 0.12 : 0.06;
    const confidenceBoost = methods.includes('Teaching someone') ? 0.07 : 0.05;

    if (info.type === 'subtopic') {
      const subtopic = info.subtopic;
      subtopic.lastStudied = session.completedAt;
      subtopic.recentPerformance = Math.min(1, (subtopic.recentPerformance || 0.6) + performanceBoost);
      subtopic.confidence = Math.min(1, (subtopic.confidence || 0.6) + confidenceBoost);
      subtopic.missedSessions = Math.max(0, (subtopic.missedSessions || 0) - 1);
    }

    topic.lastStudied = session.completedAt;
    topic.recentPerformance = Math.min(1, (topic.recentPerformance || 0.6) + (performanceBoost / 2));
    topic.confidence = Math.min(1, (topic.confidence || 0.6) + (confidenceBoost / 2));
    topic.missedSessions = Math.max(0, (topic.missedSessions || 0) - 1);
    persist(STORAGE_KEYS.subjects, state.subjects);

    if (state.plan && activePlanEntryId) {
      Object.values(state.plan.days).forEach((entries) => {
        entries.forEach((entry) => {
          if (entry.id === activePlanEntryId) {
            entry.completed = true;
          }
        });
      });
      persist(STORAGE_KEYS.plan, state.plan);
    }

    generateAdaptivePlan(state.settings.dailyHours || 3, state.settings.prioritiseTests);
  }

  function trackMissedSessions() {
    if (!state.plan || !state.plan.days) return;
    const todayKey = formatDateKey(new Date());
    Object.entries(state.plan.days).forEach(([dateKey, entries]) => {
      if (dateKey >= todayKey) return;
      entries.forEach((entry) => {
        if (!entry.completed && !entry.missedLogged) {
          const info = resolveStudyItem(entry.topicId);
          if (info) {
            if (info.type === 'subtopic') {
              info.subtopic.missedSessions = (info.subtopic.missedSessions || 0) + 1;
              info.topic.missedSessions = (info.topic.missedSessions || 0) + 0.5;
            } else {
              info.topic.missedSessions = (info.topic.missedSessions || 0) + 1;
            }
            entry.missedLogged = true;
          }
        }
      });
    });
    persist(STORAGE_KEYS.plan, state.plan);
    persist(STORAGE_KEYS.subjects, state.subjects);
  }

  function closeTopicModalOnEscape(event) {
    if (event.key === 'Escape') {
      closeStudyMode();
      closeTopicModal();
    }
  }

  document.addEventListener('keydown', closeTopicModalOnEscape);

  function loadFromStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.error('Failed to load', key, error);
      return fallback;
    }
  }

  function persist(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function slug(text) {
    return text
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-');
  }

  function startOfDay(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function formatDateKey(date) {
    return startOfDay(date).toISOString().slice(0, 10);
  }

  function differenceInDays(later, earlier) {
    const diff = startOfDay(later) - startOfDay(earlier);
    return Math.round(diff / (1000 * 60 * 60 * 24));
  }
})();
