export function createInitialState() {
  return {
    mode: "focus",
    durationMinutes: 25,
    remainingSeconds: 25 * 60,
    running: false,
    completedSprints: 0,
    focusedMinutes: 0,
    activeTaskId: null,
    tasks: [
      {
        id: "task-1",
        title: "Design domain architecture & state model",
        priority: "high",
        estimatedSprints: 2,
        completedSprints: 1,
        completed: false,
      },
      {
        id: "task-2",
        title: "Ship interactive sprint timer and telemetry view",
        priority: "medium",
        estimatedSprints: 2,
        completedSprints: 0,
        completed: false,
      },
    ],
    sessions: [],
  };
}

export function formatClock(totalSeconds) {
  const clamped = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = String(Math.floor(clamped / 60)).padStart(2, "0");
  const secs = String(clamped % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function addTask(state, { title, priority = "medium", estimatedSprints = 1 }) {
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) {
    throw new Error("Task title is required");
  }
  const task = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: cleanTitle,
    priority,
    estimatedSprints: Math.max(1, Number(estimatedSprints) || 1),
    completedSprints: 0,
    completed: false,
  };
  return {
    ...state,
    activeTaskId: state.activeTaskId || task.id,
    tasks: [task, ...state.tasks],
  };
}

export function toggleTaskCompletion(state, taskId) {
  return {
    ...state,
    tasks: state.tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    ),
  };
}

export function recordCompletedSprint(state, occurredAt = new Date().toISOString()) {
  const minutes = Number(state.durationMinutes) || 25;
  const activeTask =
    state.tasks.find((t) => t.id === state.activeTaskId) ||
    state.tasks.find((t) => !t.completed);
  const updatedTasks = state.tasks.map((t) => {
    if (activeTask && t.id === activeTask.id) {
      const nextCount = t.completedSprints + 1;
      return {
        ...t,
        completedSprints: nextCount,
        completed: nextCount >= t.estimatedSprints ? true : t.completed,
      };
    }
    return t;
  });

  const sessionEntry = {
    id: `session-${state.completedSprints + 1}`,
    mode: state.mode,
    minutes,
    taskTitle: activeTask ? activeTask.title : "Unassigned Focus Sprint",
    occurredAt,
  };

  return {
    ...state,
    running: false,
    remainingSeconds: minutes * 60,
    completedSprints: state.completedSprints + 1,
    focusedMinutes: state.focusedMinutes + minutes,
    tasks: updatedTasks,
    sessions: [sessionEntry, ...state.sessions],
  };
}

export function computeMetrics(state) {
  const completedTasks = state.tasks.filter((t) => t.completed).length;
  const openTasks = state.tasks.length - completedTasks;
  const ratio = (completedTasks + state.completedSprints) / (state.tasks.length + 1);
  const focusScore = state.tasks.length ? Math.min(100, Math.round(ratio * 100)) : 100;
  return {
    completedSprints: state.completedSprints,
    focusedMinutes: state.focusedMinutes,
    completedTasks,
    openTasks,
    focusScore,
  };
}

if (typeof document !== "undefined") {
  let state = createInitialState();
  let timerHandle = null;

  const displayEl = document.getElementById("timer-display");
  const bannerEl = document.getElementById("active-task-banner");
  const startPauseBtn = document.getElementById("btn-start-pause");
  const completeBtn = document.getElementById("btn-complete-sprint");
  const resetBtn = document.getElementById("btn-reset");
  const taskForm = document.getElementById("task-form");
  const taskListEl = document.getElementById("task-list");
  const sessionLogEl = document.getElementById("session-log");
  const exportBtn = document.getElementById("btn-export-json");

  function render() {
    if (displayEl) displayEl.textContent = formatClock(state.remainingSeconds);
    if (startPauseBtn) startPauseBtn.textContent = state.running ? "Pause Sprint" : "Start Sprint";
    const activeTask =
      state.tasks.find((t) => t.id === state.activeTaskId) ||
      state.tasks.find((t) => !t.completed);
    if (bannerEl) {
      const progress = activeTask
        ? `${activeTask.completedSprints}/${activeTask.estimatedSprints} sprints`
        : "";
      bannerEl.textContent = activeTask
        ? `Active deliverable: ${activeTask.title} (${progress})`
        : "All backlog deliverables completed! Add another task or run a free sprint.";
    }

    const metrics = computeMetrics(state);
    const elSprints = document.getElementById("metric-sprints");
    const elMinutes = document.getElementById("metric-minutes");
    const elTasks = document.getElementById("metric-tasks");
    const elScore = document.getElementById("metric-score");
    const elStreak = document.getElementById("streak-pill");
    const elBacklog = document.getElementById("backlog-counter");

    if (elSprints) elSprints.textContent = String(metrics.completedSprints);
    if (elMinutes) elMinutes.textContent = String(metrics.focusedMinutes);
    if (elTasks) elTasks.textContent = String(metrics.completedTasks);
    if (elScore) elScore.textContent = `${metrics.focusScore}%`;
    if (elStreak) elStreak.textContent = `Streak: ${metrics.completedSprints} sprints`;
    if (elBacklog) elBacklog.textContent = `${metrics.openTasks} open`;

    if (taskListEl) {
      taskListEl.innerHTML = "";
      state.tasks.forEach((task) => {
        const li = document.createElement("li");
        li.className = `task-item ${task.completed ? "completed" : ""}`;
        li.innerHTML = `
          <div>
            <strong>${task.title}</strong>
            <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 0.2rem;">
              Progress: ${task.completedSprints}/${task.estimatedSprints} sprints
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="badge badge-${task.priority}">${task.priority}</span>
            <button
              class="btn btn-secondary btn-sm"
              data-action="focus"
              data-id="${task.id}"
            >Focus</button>
            <button class="btn btn-secondary btn-sm" data-action="toggle" data-id="${task.id}">
              ${task.completed ? "Reopen" : "Done"}
            </button>
          </div>
        `;
        taskListEl.appendChild(li);
      });
    }

    if (sessionLogEl) {
      sessionLogEl.innerHTML = "";
      if (state.sessions.length === 0) {
        const empty = document.createElement("li");
        empty.className = "log-item";
        empty.textContent = "No completed sprints yet in this session.";
        sessionLogEl.appendChild(empty);
      } else {
        state.sessions.forEach((entry) => {
          const li = document.createElement("li");
          li.className = "log-item";
          li.innerHTML = `
            <span><strong>${entry.taskTitle}</strong> (${entry.minutes}m ${entry.mode})</span>
            <span style="color: #94a3b8; font-size: 0.8rem;">${entry.occurredAt}</span>
          `;
          sessionLogEl.appendChild(li);
        });
      }
    }
  }

  document.querySelectorAll(".mode-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const minutes = Number(btn.getAttribute("data-minutes") || 25);
      const mode = btn.getAttribute("data-mode") || "focus";
      state = {
        ...state,
        mode,
        durationMinutes: minutes,
        remainingSeconds: minutes * 60,
        running: false,
      };
      render();
    });
  });

  startPauseBtn?.addEventListener("click", () => {
    state = { ...state, running: !state.running };
    if (state.running && !timerHandle) {
      timerHandle = setInterval(() => {
        if (!state.running) return;
        if (state.remainingSeconds <= 1) {
          state = recordCompletedSprint(state);
        } else {
          state = { ...state, remainingSeconds: state.remainingSeconds - 1 };
        }
        render();
      }, 1000);
    }
    render();
  });

  completeBtn?.addEventListener("click", () => {
    state = recordCompletedSprint(state);
    render();
  });

  resetBtn?.addEventListener("click", () => {
    state = {
      ...state,
      running: false,
      remainingSeconds: state.durationMinutes * 60,
    };
    render();
  });

  taskForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const titleInput = document.getElementById("task-title-input");
    const priorityInput = document.getElementById("task-priority-input");
    const estimateInput = document.getElementById("task-estimate-input");
    if (!titleInput?.value.trim()) return;
    state = addTask(state, {
      title: titleInput.value,
      priority: priorityInput?.value || "medium",
      estimatedSprints: Number(estimateInput?.value || 2),
    });
    titleInput.value = "";
    render();
  });

  taskListEl?.addEventListener("click", (e) => {
    const target = e.target.closest("button");
    if (!target) return;
    const id = target.getAttribute("data-id");
    const action = target.getAttribute("data-action");
    if (action === "focus") {
      state = { ...state, activeTaskId: id };
    } else if (action === "toggle") {
      state = toggleTaskCompletion(state, id);
    }
    render();
  });

  exportBtn?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "focuspulse-session.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  render();
}
