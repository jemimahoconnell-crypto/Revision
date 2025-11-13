const STORAGE_KEY = 'studyFlowState-v1';
const DEFAULT_EXAM_DATE = '2026-06-01';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SUBJECT_COLOURS = ['#f3cbd3', '#f2d5c3', '#d5c4f2', '#f2e2c3'];

const defaultTopics = {
  Biology: [
    'Biological Molecules',
    'Cells',
    'Exchange',
    'DNA, Genes, and Variation',
    'Energy Transfers',
    'Responses to Stimuli',
    'Genetics, Populations, Evolution, Ecosystems',
    'Control of Gene Expression'
  ],
  PE: [
    'Applied Anatomy & Physiology',
    'Skill Acquisition',
    'Sport & Society',
    'Exercise Physiology',
    'Biomechanical Movement',
    'Sport Psychology',
    'Technology in Sport'
  ]
};

let state = {};

/**
 * Initialise default state for first load.
 */
function buildDefaultState() {
  const subjects = {};
  Object.keys(defaultTopics).forEach((subjectName, index) => {
    subjects[subjectName] = {
      id: crypto.randomUUID(),
      order: index,
      topics: defaultTopics[subjectName].map((topic, tIndex) => ({
        id: crypto.randomUUID(),
        name: topic,
        weakness: 3,
        difficultyWeight: 1,
        examImportance: 3,
        lastRevised: null,
        covered: false,
        confidence: 'medium',
        timesRevised: 0,
        subtopics: [],
        lastMarkedDifficulty: 'none'
      }))
    };
  });

  return {
    settings: {
      examDate: DEFAULT_EXAM_DATE,
      sessionLength: 40,
      daysPerWeek: 6,
      availability: {
        Monday: 2,
        Tuesday: 2,
        Wednesday: 2,
        Thursday: 2,
        Friday: 1.5,
        Saturday: 3,
        Sunday: 2
      },
      learningPreference: 'mixed',
      toggles: {
        spaced: true,
        focusWeak: true
      },
      targetGrades: {
        Biology: 'A',
        PE: 'A'
      },
      predictedGrades: {
        Biology: 'C',
        PE: 'C'
      }
    },
    subjects,
    tasks: {
      today: [],
      weekly: {},
      lastGenerated: null
    },
    progress: {
      streak: 0,
      lastCompletionDate: null,
      hoursHistory: []
    },
    pastPapers: {
      Biology: ['Paper 1', 'Paper 2', 'Paper 3'].map(name => defaultPaperEntry(name)),
      PE: ['Paper 1', 'Paper 2'].map(name => defaultPaperEntry(name))
    }
  };
}

function defaultPaperEntry(name) {
  return {
    id: crypto.randomUUID(),
    name,
    completed: false,
    markScheme: false,
    corrections: false,
    score: '',
    notes: '',
    lastUpdated: null
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return buildDefaultState();
  }
  try {
    const parsed = JSON.parse(raw);
    // ensure defaults exist if new keys added
    return mergeState(parsed, buildDefaultState());
  } catch (error) {
    console.error('Failed to parse stored state, using defaults', error);
    return buildDefaultState();
  }
}

function mergeState(saved, defaults) {
  // simple deep merge preserving saved values
  const merged = structuredClone(defaults);
  function deepMerge(target, source) {
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = target[key] || {};
        deepMerge(target[key], source[key]);
      } else {
        if (key in target) {
          target[key] = source[key];
        }
      }
    });
    return target;
  }
  return deepMerge(merged, saved);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function init() {
  state = loadState();
  bindNavScrolling();
  bindHomeActions();
  bindPlannerActions();
  bindStudyMode();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);

function renderAll() {
  renderCountdown();
  renderTodayGlance();
  renderPlanner();
  renderSubjectSections();
  renderSettings();
  renderPastPapers();
  renderProgress();
}

function bindNavScrolling() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.querySelector(link.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
    });
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const id = entry.target.getAttribute('id');
      const activeLink = document.querySelector(`.nav-link[href="#${id}"]`);
      if (entry.isIntersecting) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        if (activeLink) activeLink.classList.add('active');
      }
    });
  }, { threshold: 0.4 });

  document.querySelectorAll('section').forEach(section => observer.observe(section));
}

function bindHomeActions() {
  document.getElementById('refreshToday').addEventListener('click', () => {
    generateTodayPlan();
    renderPlanner();
    renderTodayGlance();
    renderProgress();
  });

  document.getElementById('whatNext').addEventListener('click', () => {
    const next = determineNextTask();
    const suggestion = document.getElementById('nextSuggestion');
    if (!next) {
      suggestion.textContent = 'No tasks found — generate a plan to get started.';
      return;
    }
    suggestion.textContent = `Next: ${next.subject} — ${next.topicName} — ${next.duration} mins of ${next.activity}.`;
  });

  document.getElementById('editExamDate').addEventListener('click', () => {
    document.getElementById('settings').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('examDate').focus();
  });
}

function bindPlannerActions() {
  document.getElementById('generateWeekly').addEventListener('click', () => {
    generateWeeklyPlan();
    renderPlanner();
  });

  document.getElementById('generateToday').addEventListener('click', () => {
    generateTodayPlan();
    renderPlanner();
    renderTodayGlance();
    renderProgress();
  });
}

function bindStudyMode() {
  const toggle = document.getElementById('studyModeToggle');
  const panel = document.getElementById('studyModePanel');
  toggle.addEventListener('click', () => {
    const isActive = panel.classList.toggle('active');
    toggle.textContent = isActive ? 'Exit Study Mode' : 'Study Mode';
    if (isActive) {
      document.body.classList.add('study-mode-active');
    } else {
      document.body.classList.remove('study-mode-active');
    }
  });
}

// Countdown
function renderCountdown() {
  const examDateInput = document.getElementById('examDate');
  if (examDateInput) {
    examDateInput.value = state.settings.examDate;
  }
  const countdownEl = document.getElementById('countdownTimer');
  const target = new Date(state.settings.examDate);
  const diff = target - new Date();
  if (isNaN(diff)) {
    countdownEl.textContent = 'Set an exam date.';
    return;
  }
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  countdownEl.textContent = `${months} months ${remainingDays} days`;
}

function renderTodayGlance() {
  const todayTasks = state.tasks.today || [];
  const tasksCount = todayTasks.length;
  const totalMinutes = todayTasks.reduce((sum, task) => sum + task.duration, 0);
  const highPriority = todayTasks.filter(task => task.priorityScore >= 6).length;
  document.getElementById('todayTasksCount').textContent = tasksCount;
  document.getElementById('todayStudyMinutes').textContent = `${totalMinutes} mins`;
  document.getElementById('todayHighPriority').textContent = highPriority;
}

// Planner rendering
function renderPlanner() {
  const hoursInput = document.getElementById('todayHours');
  const maxSessionsInput = document.getElementById('maxSessions');
  hoursInput.value = state.settings.availability[getDayName(new Date())] || 2;
  maxSessionsInput.value = Math.ceil((hoursInput.value * 60) / state.settings.sessionLength);

  renderTodayTasks();
  renderWeeklyPlan();
  renderStudyModeList();
}

function renderTodayTasks() {
  const list = document.getElementById('todayPlan');
  list.innerHTML = '';
  (state.tasks.today || []).forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item ${task.status === 'done' ? 'done' : ''}`;
    li.dataset.id = task.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.status === 'done';
    checkbox.addEventListener('change', () => toggleTaskCompletion(task.id, checkbox.checked));

    const info = document.createElement('div');
    info.innerHTML = `<strong>${task.subject}</strong> · ${task.topicName}<div class="task-meta">${task.activity} · ${task.duration} mins</div>`;

    const difficulty = document.createElement('div');
    difficulty.className = 'difficulty-buttons';
    ['Hard', 'Okay', 'Easy'].forEach(level => {
      const button = document.createElement('button');
      button.textContent = level;
      if (task.difficulty === level.toLowerCase()) {
        button.classList.add('active');
      }
      button.addEventListener('click', () => setTaskDifficulty(task.id, level.toLowerCase()));
      difficulty.appendChild(button);
    });

    const actions = document.createElement('div');
    actions.className = 'task-actions';
    actions.appendChild(difficulty);

    li.appendChild(checkbox);
    li.appendChild(info);
    li.appendChild(actions);
    list.appendChild(li);
  });
}

function renderStudyModeList() {
  const list = document.getElementById('studyModeList');
  list.innerHTML = '';
  (state.tasks.today || []).forEach(task => {
    const item = document.createElement('li');
    item.className = 'study-mode-item';
    const label = document.createElement('span');
    label.textContent = `${task.subject} – ${task.topicName} (${task.activity}, ${task.duration} mins)`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.status === 'done';
    checkbox.addEventListener('change', () => toggleTaskCompletion(task.id, checkbox.checked));
    item.appendChild(label);
    item.appendChild(checkbox);
    list.appendChild(item);
  });
}

function renderWeeklyPlan() {
  const container = document.getElementById('weeklyPlan');
  container.innerHTML = '';
  const week = state.tasks.weekly || {};
  Object.keys(week).sort().forEach(date => {
    const dayCard = document.createElement('div');
    dayCard.className = 'week-card';
    const dayName = new Date(date);
    const title = document.createElement('h4');
    title.textContent = `${dayName.toLocaleDateString(undefined, { weekday: 'short' })} ${date}`;
    dayCard.appendChild(title);

    const list = document.createElement('ul');
    week[date].forEach(session => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${session.subject}</strong> · ${session.topicName} (${session.activity}, ${session.duration} mins)`;
      list.appendChild(li);
    });
    dayCard.appendChild(list);
    container.appendChild(dayCard);
  });
}

// Subject sections
function renderSubjectSections() {
  renderAccordion('biologyTopics', 'Biology');
  renderAccordion('peTopics', 'PE');
}

function renderAccordion(containerId, subjectName) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const subject = state.subjects[subjectName];
  if (!subject) return;

  subject.topics.forEach((topic, index) => {
    const panel = document.createElement('div');
    panel.className = 'topic-panel';

    const header = document.createElement('div');
    header.className = 'topic-header';
    header.innerHTML = `<h3>${topic.name}</h3><span>${topic.confidence}</span>`;
    header.addEventListener('click', () => content.classList.toggle('active'));

    const content = document.createElement('div');
    content.className = 'topic-content';

    const stats = document.createElement('div');
    stats.className = 'topic-stats';
    stats.innerHTML = `
      <div><input type="checkbox" ${topic.covered ? 'checked' : ''} data-topic="${topic.id}" class="topic-covered"> Content covered</div>
      <div>Last revised: ${topic.lastRevised ? new Date(topic.lastRevised).toLocaleDateString() : 'Never'}</div>
      <div>Times revised: ${topic.timesRevised || 0}</div>
    `;

    const subtopicList = document.createElement('ul');
    subtopicList.className = 'subtopic-list';
    topic.subtopics.forEach(sub => {
      const item = document.createElement('li');
      item.className = 'subtopic-item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = sub.covered;
      checkbox.addEventListener('change', () => {
        sub.covered = checkbox.checked;
        if (checkbox.checked) {
          sub.lastRevised = Date.now();
        }
        saveState();
        renderProgress();
      });
      const input = document.createElement('input');
      input.type = 'text';
      input.value = sub.name;
      input.addEventListener('input', () => {
        sub.name = input.value;
        saveState();
      });
      const actions = document.createElement('div');
      actions.className = 'subtopic-actions';
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', () => {
        topic.subtopics = topic.subtopics.filter(s => s.id !== sub.id);
        saveState();
        renderSubjectSections();
      });
      actions.appendChild(deleteBtn);
      item.appendChild(checkbox);
      item.appendChild(input);
      item.appendChild(actions);
      subtopicList.appendChild(item);
    });

    const addSubtopic = document.createElement('button');
    addSubtopic.className = 'secondary-btn';
    addSubtopic.textContent = 'Add subtopic';
    addSubtopic.addEventListener('click', () => {
      topic.subtopics.push({
        id: crypto.randomUUID(),
        name: 'New subtopic',
        covered: false,
        lastRevised: null
      });
      saveState();
      renderSubjectSections();
    });

    content.appendChild(stats);
    content.appendChild(subtopicList);
    content.appendChild(addSubtopic);

    panel.appendChild(header);
    panel.appendChild(content);
    container.appendChild(panel);
  });

  container.querySelectorAll('.topic-covered').forEach(checkbox => {
    checkbox.addEventListener('change', event => {
      const topicId = event.target.dataset.topic;
      const topic = findTopicById(subjectName, topicId);
      if (topic) {
        topic.covered = event.target.checked;
        if (topic.covered) {
          topic.lastRevised = Date.now();
          topic.timesRevised = Math.max(topic.timesRevised || 0, 1);
        }
        saveState();
        renderProgress();
      }
    });
  });
}

function renderSettings() {
  const examDate = document.getElementById('examDate');
  examDate.value = state.settings.examDate;
  examDate.onchange = () => {
    state.settings.examDate = examDate.value;
    saveState();
    renderCountdown();
  };

  const sessionLength = document.getElementById('sessionLength');
  sessionLength.value = state.settings.sessionLength;
  sessionLength.onchange = () => {
    state.settings.sessionLength = Number(sessionLength.value) || 30;
    saveState();
  };

  const daysPerWeek = document.getElementById('daysPerWeek');
  daysPerWeek.value = state.settings.daysPerWeek;
  daysPerWeek.onchange = () => {
    state.settings.daysPerWeek = Number(daysPerWeek.value) || 5;
    saveState();
  };

  renderDailyHours();
  renderSubjectManager();
  renderGrades();

  const learningPreference = document.getElementById('learningPreference');
  learningPreference.value = state.settings.learningPreference;
  learningPreference.onchange = () => {
    state.settings.learningPreference = learningPreference.value;
    saveState();
  };

  const spacedToggle = document.getElementById('spacedToggle');
  spacedToggle.checked = state.settings.toggles.spaced;
  spacedToggle.onchange = () => {
    state.settings.toggles.spaced = spacedToggle.checked;
    saveState();
  };

  const weakToggle = document.getElementById('weakToggle');
  weakToggle.checked = state.settings.toggles.focusWeak;
  weakToggle.onchange = () => {
    state.settings.toggles.focusWeak = weakToggle.checked;
    saveState();
  };

  document.getElementById('addSubject').onclick = () => {
    const name = prompt('Subject name');
    if (!name) return;
    if (state.subjects[name]) {
      alert('Subject already exists.');
      return;
    }
    state.subjects[name] = {
      id: crypto.randomUUID(),
      order: Object.keys(state.subjects).length,
      topics: []
    };
    state.settings.targetGrades[name] = 'A';
    state.settings.predictedGrades[name] = 'C';
    saveState();
    renderAll();
  };
}

function renderDailyHours() {
  const container = document.getElementById('dailyHoursInputs');
  container.innerHTML = '';
  DAYS.forEach(day => {
    const label = document.createElement('label');
    label.innerHTML = `${day}<input type="number" min="0" step="0.25" value="${state.settings.availability[day] || 0}" />`;
    const input = label.querySelector('input');
    input.addEventListener('change', () => {
      state.settings.availability[day] = Number(input.value) || 0;
      saveState();
    });
    container.appendChild(label);
  });
}

function renderSubjectManager() {
  const manager = document.getElementById('subjectsManager');
  manager.innerHTML = '';
  Object.keys(state.subjects).forEach(subjectName => {
    const subject = state.subjects[subjectName];
    const card = document.createElement('div');
    card.className = 'subject-card';

    const header = document.createElement('header');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = subjectName;
    nameInput.addEventListener('change', () => renameSubject(subjectName, nameInput.value));
    header.appendChild(nameInput);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteSubject(subjectName));
    header.appendChild(deleteBtn);

    card.appendChild(header);

    const topicList = document.createElement('div');
    topicList.className = 'subject-topics';
    subject.topics.forEach((topic, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'today-stat';

      const nameField = document.createElement('input');
      nameField.type = 'text';
      nameField.value = topic.name;
      nameField.addEventListener('input', () => {
        topic.name = nameField.value;
        saveState();
        renderSubjectSections();
      });

      const weakness = document.createElement('select');
      weakness.innerHTML = `
        <option value="1">Strong</option>
        <option value="2">Okay</option>
        <option value="3">Needs work</option>
        <option value="4">Weak</option>
        <option value="5">Critical</option>`;
      weakness.value = topic.weakness || 3;
      weakness.addEventListener('change', () => {
        topic.weakness = Number(weakness.value);
        saveState();
      });

      const importance = document.createElement('select');
      importance.innerHTML = `
        <option value="1">Low importance</option>
        <option value="2">Medium</option>
        <option value="3">High</option>
        <option value="4">Core</option>`;
      importance.value = topic.examImportance || 3;
      importance.addEventListener('change', () => {
        topic.examImportance = Number(importance.value);
        saveState();
      });

      const controls = document.createElement('div');
      controls.className = 'topic-item-controls';

      const up = document.createElement('button');
      up.textContent = '↑';
      up.disabled = index === 0;
      up.addEventListener('click', () => moveTopic(subjectName, index, -1));
      const down = document.createElement('button');
      down.textContent = '↓';
      down.disabled = index === subject.topics.length - 1;
      down.addEventListener('click', () => moveTopic(subjectName, index, 1));
      const remove = document.createElement('button');
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        subject.topics.splice(index, 1);
        saveState();
        renderSubjectManager();
        renderSubjectSections();
      });

      controls.append(up, down, remove);
      wrapper.appendChild(nameField);
      wrapper.appendChild(weakness);
      wrapper.appendChild(importance);
      wrapper.appendChild(controls);
      topicList.appendChild(wrapper);
    });

    const addTopic = document.createElement('button');
    addTopic.className = 'secondary-btn';
    addTopic.textContent = 'Add topic';
    addTopic.addEventListener('click', () => {
      subject.topics.push({
        id: crypto.randomUUID(),
        name: 'New topic',
        weakness: 3,
        difficultyWeight: 1,
        examImportance: 2,
        lastRevised: null,
        covered: false,
        confidence: 'medium',
        timesRevised: 0,
        subtopics: [],
        lastMarkedDifficulty: 'none'
      });
      saveState();
      renderSubjectManager();
      renderSubjectSections();
    });

    card.appendChild(topicList);
    card.appendChild(addTopic);
    manager.appendChild(card);
  });
}

function renderGrades() {
  const container = document.getElementById('gradeSettings');
  container.innerHTML = '';
  Object.keys(state.subjects).forEach(subjectName => {
    const wrapper = document.createElement('div');
    wrapper.className = 'today-stat';
    wrapper.style.alignItems = 'flex-start';
    wrapper.innerHTML = `
      <div>
        <strong>${subjectName}</strong>
        <div>Target grade</div>
        <input type="text" value="${state.settings.targetGrades[subjectName] || 'A'}" class="target-grade" data-subject="${subjectName}">
      </div>
      <div>
        <div>Predicted grade</div>
        <input type="text" value="${state.settings.predictedGrades[subjectName] || 'C'}" class="predicted-grade" data-subject="${subjectName}">
      </div>
    `;
    container.appendChild(wrapper);
  });

  container.querySelectorAll('.target-grade').forEach(input => {
    input.addEventListener('change', () => {
      state.settings.targetGrades[input.dataset.subject] = input.value.toUpperCase();
      saveState();
      renderProgress();
    });
  });

  container.querySelectorAll('.predicted-grade').forEach(input => {
    input.addEventListener('change', () => {
      state.settings.predictedGrades[input.dataset.subject] = input.value.toUpperCase();
      saveState();
      renderProgress();
    });
  });
}

function renameSubject(oldName, newName) {
  if (!newName || oldName === newName) return;
  if (state.subjects[newName]) {
    alert('A subject with that name already exists.');
    return;
  }
  state.subjects[newName] = state.subjects[oldName];
  delete state.subjects[oldName];
  state.settings.targetGrades[newName] = state.settings.targetGrades[oldName];
  state.settings.predictedGrades[newName] = state.settings.predictedGrades[oldName];
  delete state.settings.targetGrades[oldName];
  delete state.settings.predictedGrades[oldName];
  saveState();
  renderAll();
}

function deleteSubject(name) {
  if (!confirm(`Delete ${name}?`)) return;
  delete state.subjects[name];
  delete state.settings.targetGrades[name];
  delete state.settings.predictedGrades[name];
  saveState();
  renderAll();
}

function moveTopic(subjectName, index, direction) {
  const topics = state.subjects[subjectName].topics;
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= topics.length) return;
  const [moved] = topics.splice(index, 1);
  topics.splice(newIndex, 0, moved);
  saveState();
  renderSubjectManager();
  renderSubjectSections();
}

// Past papers
function renderPastPapers() {
  renderPastPaperList('Biology', 'biologyPapers');
  renderPastPaperList('PE', 'pePapers');
  renderPastPaperSummary();
}

function renderPastPaperList(subjectName, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const papers = state.pastPapers[subjectName] || [];
  papers.forEach(paper => {
    const entry = document.createElement('div');
    entry.className = 'pastpaper-entry';
    entry.innerHTML = `
      <strong>${paper.name}</strong>
      <label><input type="checkbox" ${paper.completed ? 'checked' : ''} data-action="completed"> Completed</label>
      <label><input type="checkbox" ${paper.markScheme ? 'checked' : ''} data-action="markScheme"> Mark scheme reviewed</label>
      <label><input type="checkbox" ${paper.corrections ? 'checked' : ''} data-action="corrections"> Mistakes corrected</label>
      <label>Score (%)<input type="number" min="0" max="100" value="${paper.score}" data-action="score"></label>
      <label>Notes<textarea data-action="notes">${paper.notes || ''}</textarea></label>
    `;
    entry.querySelectorAll('input, textarea').forEach(input => {
      input.addEventListener('change', () => {
        const action = input.dataset.action;
        if (action === 'completed' || action === 'markScheme' || action === 'corrections') {
          paper[action] = input.checked;
        } else if (action === 'score') {
          paper.score = input.value;
        } else if (action === 'notes') {
          paper.notes = input.value;
        }
        paper.lastUpdated = Date.now();
        saveState();
        renderPastPaperSummary();
        renderProgress();
      });
    });
    container.appendChild(entry);
  });
}

function renderPastPaperSummary() {
  const summary = document.getElementById('paperSummary');
  const stats = Object.keys(state.pastPapers).map(subjectName => {
    const papers = state.pastPapers[subjectName];
    const completed = papers.filter(p => p.completed).length;
    const avgScore = papers.length ? Math.round(papers.reduce((acc, p) => acc + (Number(p.score) || 0), 0) / papers.length) : 0;
    return { subjectName, completed, total: papers.length, avgScore };
  });

  summary.innerHTML = stats.map(stat => `
    <div>
      <strong>${stat.subjectName}</strong>
      <span>${stat.completed}/${stat.total} completed</span>
      <span>Average score: ${stat.avgScore}%</span>
    </div>
  `).join('');
}

// Planner generation logic
function generateTodayPlan() {
  const today = formatDate(new Date());
  const hoursInput = Number(document.getElementById('todayHours').value) || state.settings.availability[getDayName(new Date())] || 2;
  const maxSessionsInput = Number(document.getElementById('maxSessions').value) || Math.ceil((hoursInput * 60) / state.settings.sessionLength);
  const sessions = buildDailySessions(hoursInput, maxSessionsInput, today);
  state.tasks.today = sessions;
  if (!state.tasks.weekly) state.tasks.weekly = {};
  state.tasks.weekly[today] = sessions;
  state.tasks.lastGenerated = today;
  saveState();
}

function generateWeeklyPlan() {
  const sessionsPerWeek = {};
  const start = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dayName = getDayName(date);
    const hours = state.settings.availability[dayName] || 0;
    if (hours <= 0) continue;
    const formatted = formatDate(date);
    sessionsPerWeek[formatted] = buildDailySessions(hours, Math.ceil((hours * 60) / state.settings.sessionLength), formatted);
  }
  state.tasks.weekly = sessionsPerWeek;
  state.tasks.today = sessionsPerWeek[formatDate(new Date())] || [];
  state.tasks.lastGenerated = formatDate(new Date());
  saveState();
}

function buildDailySessions(hours, maxSessions, date) {
  const totalMinutes = Math.round(hours * 60);
  const sessionLength = state.settings.sessionLength;
  const numberOfSessions = Math.min(maxSessions, Math.max(1, Math.floor(totalMinutes / sessionLength)));
  const priority = calculatePriorityScores(date);
  if (!priority.length) return [];

  const distribution = allocateSubjects(numberOfSessions);
  const sessions = [];
  const usedTopics = {};
  distribution.forEach((subjectName, index) => {
    const topic = pickNextTopic(subjectName, usedTopics, priority, date);
    if (!topic) return;
    const activity = chooseActivity(subjectName, topic);
    const task = {
      id: crypto.randomUUID(),
      date,
      subject: subjectName,
      topicId: topic.id,
      topicName: topic.name,
      duration: sessionLength,
      activity,
      priorityScore: topic.priority,
      status: 'pending',
      difficulty: topic.lastMarkedDifficulty || 'none',
      highPriority: topic.priority >= 6
    };
    sessions.push(task);
    usedTopics[topic.id] = (usedTopics[topic.id] || 0) + 1;
  });

  // If exam practice proportion triggered, add exam tasks
  const examPracticeCount = distribution.filter(name => name === 'Exam Practice').length;
  if (examPracticeCount > 0) {
    const examTasks = buildExamTasks(examPracticeCount, sessionLength);
    sessions.push(...examTasks);
  }

  return sessions;
}

function allocateSubjects(numberOfSessions) {
  const distribution = [];
  let biologyWeight = 0.5;
  let peWeight = 0.3;
  let examWeight = 0.2;

  const pastPaperCompletion = calculatePastPaperCompletion();
  if (pastPaperCompletion < 0.2) {
    examWeight = 0.3;
    biologyWeight = 0.45;
    peWeight = 0.25;
  }

  const weaknessScores = getSubjectWeakness();
  if (weaknessScores.Biology > weaknessScores.PE + 0.15) {
    biologyWeight += 0.1;
    peWeight -= 0.05;
  } else if (weaknessScores.PE > weaknessScores.Biology + 0.15) {
    peWeight += 0.1;
    biologyWeight -= 0.05;
  }

  const subjects = ['Biology', 'PE'];
  const weights = [biologyWeight, peWeight, examWeight];
  const names = [...subjects, 'Exam Practice'];

  for (let i = 0; i < numberOfSessions; i++) {
    const pick = weightedRandom(names, weights);
    distribution.push(pick);
  }

  return distribution;
}

function weightedRandom(names, weights) {
  const total = weights.reduce((acc, val) => acc + val, 0);
  const rand = Math.random() * total;
  let sum = 0;
  for (let i = 0; i < names.length; i++) {
    sum += weights[i];
    if (rand <= sum) return names[i];
  }
  return names[0];
}

function pickNextTopic(subjectName, usedTopics, priorityList, date) {
  if (!state.subjects[subjectName]) return null;
  const candidates = priorityList.filter(item => item.subject === subjectName);
  const sorted = candidates.sort((a, b) => b.priority - a.priority);
  for (const candidate of sorted) {
    if ((usedTopics[candidate.id] || 0) >= 1) continue;
    if (!canScheduleTopic(candidate, date)) continue;
    return candidate;
  }
  return sorted[0] || null;
}

function canScheduleTopic(topic, date) {
  if (!state.settings.toggles.spaced) return true;
  if (!topic.lastRevised) return true;
  const difficulty = topic.lastMarkedDifficulty || 'okay';
  const spacing = difficulty === 'hard' ? 1 : difficulty === 'okay' ? 3 : 5;
  const last = new Date(topic.lastRevised);
  const current = new Date(date);
  const diffDays = Math.floor((current - last) / (1000 * 60 * 60 * 24));
  return diffDays >= spacing;
}

function chooseActivity(subjectName, topic) {
  const preference = state.settings.learningPreference;
  if (preference === 'mixed') {
    if (!topic.covered) return 'notes';
    if (topic.timesRevised < 2) return 'active recall';
    return 'questions';
  }
  if (preference === 'notes') {
    return topic.covered ? 'active recall' : 'notes';
  }
  if (preference === 'questions') {
    return topic.covered ? 'questions' : 'notes';
  }
  if (preference === 'active') {
    return topic.covered ? 'active recall' : 'notes';
  }
  return 'notes';
}

function buildExamTasks(count, duration) {
  const subjects = Object.keys(state.subjects);
  const tasks = [];
  for (let i = 0; i < count; i++) {
    const subject = subjects[i % subjects.length];
    tasks.push({
      id: crypto.randomUUID(),
      date: formatDate(new Date()),
      subject: `${subject} Exam Practice`,
      topicId: 'exam',
      topicName: 'Past paper questions',
      duration,
      activity: 'past paper',
      priorityScore: 5,
      status: 'pending',
      difficulty: 'none',
      highPriority: true
    });
  }
  return tasks;
}

function calculatePriorityScores(date) {
  const list = [];
  Object.entries(state.subjects).forEach(([subjectName, subject]) => {
    subject.topics.forEach(topic => {
      const weaknessWeight = Number(topic.weakness || 3);
      const daysSinceLast = topic.lastRevised ? Math.floor((new Date(date) - new Date(topic.lastRevised)) / (1000 * 60 * 60 * 24)) : 30;
      const difficultyWeight = Number(topic.difficultyWeight || 1);
      const examImportance = Number(topic.examImportance || 2);
      const spacedBonus = state.settings.toggles.spaced ? Math.min(6, daysSinceLast * 0.2) : 0;
      const weaknessFactor = state.settings.toggles.focusWeak ? weaknessWeight * 0.8 : weaknessWeight * 0.5;
      const priority = (weaknessFactor * 2) + (daysSinceLast * 0.3) + (difficultyWeight * 1.5) + (examImportance * 1.2) + spacedBonus;
      list.push({ ...topic, subject: subjectName, priority });
    });
  });
  return list.sort((a, b) => b.priority - a.priority);
}

function determineNextTask() {
  const today = state.tasks.today || [];
  const pending = today.filter(task => task.status !== 'done');
  if (pending.length) {
    return pending.sort((a, b) => b.priorityScore - a.priorityScore)[0];
  }
  const futurePriority = calculatePriorityScores(formatDate(new Date()));
  return futurePriority[0];
}

// Task completion
function toggleTaskCompletion(taskId, completed) {
  const task = state.tasks.today.find(t => t.id === taskId);
  if (!task) return;
  task.status = completed ? 'done' : 'pending';
  if (completed) {
    const topic = findTopicById(task.subject, task.topicId);
    if (topic) {
      topic.lastRevised = Date.now();
      topic.timesRevised = (topic.timesRevised || 0) + 1;
      topic.covered = true;
    }
    updateStudyHistory(task.duration);
  }
  saveState();
  renderSubjectSections();
  renderTodayGlance();
  renderProgress();
  renderStudyModeList();
}

function setTaskDifficulty(taskId, difficulty) {
  const task = state.tasks.today.find(t => t.id === taskId);
  if (!task) return;
  task.difficulty = difficulty;
  const topic = findTopicById(task.subject, task.topicId);
  if (!topic) return;
  topic.lastMarkedDifficulty = difficulty;
  if (difficulty === 'hard') {
    topic.difficultyWeight = Math.min(3, (topic.difficultyWeight || 1) + 0.3);
    topic.confidence = 'low';
  } else if (difficulty === 'okay') {
    topic.difficultyWeight = Math.max(0.7, (topic.difficultyWeight || 1) - 0.05);
    topic.confidence = 'medium';
  } else if (difficulty === 'easy') {
    topic.difficultyWeight = Math.max(0.5, (topic.difficultyWeight || 1) - 0.2);
    topic.confidence = 'high';
  }
  saveState();
  renderSubjectSections();
  renderProgress();
  renderTodayTasks();
  renderStudyModeList();
}

function findTopicById(subjectName, topicId) {
  const subject = state.subjects[subjectName];
  if (!subject) return null;
  return subject.topics.find(topic => topic.id === topicId);
}

function updateStudyHistory(duration) {
  const today = formatDate(new Date());
  const entry = state.progress.hoursHistory.find(item => item.date === today);
  if (entry) {
    entry.minutes += duration;
  } else {
    state.progress.hoursHistory.push({ date: today, minutes: duration });
  }
  updateStreak(today);
}

function updateStreak(today) {
  const last = state.progress.lastCompletionDate;
  const todayDate = new Date(today);
  if (!last) {
    state.progress.streak = 1;
  } else {
    const diffDays = Math.floor((todayDate - new Date(last)) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      state.progress.streak += 1;
    } else if (diffDays === 0) {
      // same day, streak unchanged
    } else {
      state.progress.streak = 1;
    }
  }
  state.progress.lastCompletionDate = today;
  saveState();
}

// Progress tracker
function renderProgress() {
  renderSubjectProgress();
  renderHoursChart();
  renderStatus();
}

function renderSubjectProgress() {
  const container = document.getElementById('subjectProgress');
  container.innerHTML = '';
  Object.entries(state.subjects).forEach(([subjectName, subject]) => {
    const topics = subject.topics.length || 1;
    const covered = subject.topics.filter(topic => topic.covered).length;
    const confident = subject.topics.filter(topic => topic.confidence === 'high').length;
    const completionPercent = Math.round((covered / topics) * 100);
    const confidencePercent = Math.round((confident / topics) * 100);
    const grade = calculatePredictedGrade(subjectName, completionPercent, confidencePercent);

    const item = document.createElement('div');
    item.className = 'progress-item';
    item.innerHTML = `
      <div class="progress-label"><strong>${subjectName}</strong><span>Target ${state.settings.targetGrades[subjectName] || 'A'}</span></div>
      <div class="progress-bar"><span style="width:${completionPercent}%"></span></div>
      <small>${completionPercent}% content covered · ${confidencePercent}% confident · Predicted ${grade}</small>
    `;
    container.appendChild(item);
  });
}

function renderHoursChart() {
  const canvas = document.getElementById('hoursChart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const history = [...state.progress.hoursHistory].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-7);
  const maxMinutes = Math.max(60, ...history.map(item => item.minutes));
  const barWidth = canvas.width / (history.length || 1);
  history.forEach((entry, index) => {
    const height = (entry.minutes / maxMinutes) * (canvas.height - 30);
    ctx.fillStyle = SUBJECT_COLOURS[index % SUBJECT_COLOURS.length];
    ctx.fillRect(index * barWidth + 10, canvas.height - height - 20, barWidth - 20, height);
    ctx.fillStyle = '#776b66';
    ctx.font = '12px Poppins';
    ctx.fillText(entry.minutes + 'm', index * barWidth + 10, canvas.height - height - 25);
    ctx.fillText(entry.date.slice(5), index * barWidth + 10, canvas.height - 5);
  });
}

function renderStatus() {
  document.getElementById('streakCount').textContent = `${state.progress.streak || 0} days`;
  const scores = Object.keys(state.subjects).map(subjectName => calculateSubjectScore(subjectName));
  const average = scores.reduce((acc, val) => acc + val, 0) / (scores.length || 1);
  let status = 'On track';
  if (average < 0.45) status = 'Behind';
  if (average > 0.7) status = 'Ahead';
  document.getElementById('onTrackStatus').textContent = status;
}

function calculateSubjectScore(subjectName) {
  const subject = state.subjects[subjectName];
  const topics = subject.topics.length || 1;
  const covered = subject.topics.filter(topic => topic.covered).length;
  const confident = subject.topics.filter(topic => topic.confidence === 'high').length;
  const completion = covered / topics;
  const confidence = confident / topics;
  const papers = state.pastPapers[subjectName] || [];
  const paperCompletion = papers.length ? papers.filter(p => p.completed).length / papers.length : 0;
  const totalMinutes = state.progress.hoursHistory.reduce((acc, entry) => acc + entry.minutes, 0);
  const daysActive = new Set(state.progress.hoursHistory.map(entry => entry.date)).size;
  const consistency = daysActive ? Math.min(1, (state.progress.streak / 14) + (totalMinutes / (daysActive * 60)) * 0.2) : 0;
  const score = (completion * 0.35) + (paperCompletion * 0.35) + (consistency * 0.3);
  state.settings.predictedGrades[subjectName] = gradeFromScore(score);
  return score;
}

function calculatePredictedGrade(subjectName, completionPercent, confidencePercent) {
  const score = calculateSubjectScore(subjectName);
  const grade = gradeFromScore(score);
  return `${grade}`;
}

function gradeFromScore(score) {
  if (score >= 0.85) return 'A*';
  if (score >= 0.7) return 'A';
  if (score >= 0.55) return 'B';
  if (score >= 0.45) return 'C';
  if (score >= 0.35) return 'D';
  return 'E';
}

// Helpers
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getDayName(date) {
  return DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
}

function calculatePastPaperCompletion() {
  const all = Object.values(state.pastPapers).flat();
  if (!all.length) return 0;
  const completed = all.filter(p => p.completed).length;
  return completed / all.length;
}

function getSubjectWeakness() {
  const result = {};
  Object.entries(state.subjects).forEach(([name, subject]) => {
    const average = subject.topics.reduce((acc, topic) => acc + Number(topic.weakness || 3), 0) / (subject.topics.length || 1);
    result[name] = average / 5;
  });
  return result;
}
