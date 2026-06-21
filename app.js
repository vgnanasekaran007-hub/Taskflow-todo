/* =============================================
   TASKFLOW — Application Logic
   ============================================= */

(function () {
  'use strict';

  // --- Constants ---
  const STORAGE_KEY = 'taskflow_todos';
  const CATEGORIES = ['Personal', 'Work', 'Health', 'Shopping', 'Learning'];
  const CATEGORY_ICONS = {
    Personal: '👤',
    Work: '💼',
    Health: '💪',
    Shopping: '🛒',
    Learning: '📚',
  };

  // --- State ---
  let todos = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let editingId = null;

  // --- DOM References ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const taskList = $('#task-list');
  const emptyState = $('#empty-state');
  const addForm = $('#add-task-form');
  const taskInput = $('#task-input');
  const taskCategory = $('#task-category');
  const taskDue = $('#task-due');
  const searchInput = $('#search-input');
  const prioritySelector = $('#priority-selector');
  const editModal = $('#edit-modal');
  const editForm = $('#edit-form');
  const editId = $('#edit-id');
  const editTitle = $('#edit-title');
  const editCategory = $('#edit-category');
  const editDue = $('#edit-due');
  const editPriorityGroup = $('#edit-priority-group');
  const progressRing = $('#progress-ring');
  const statsPercent = $('#stats-percent');
  const statsDetail = $('#stats-detail');
  const viewTitle = $('#view-title');
  const headerDate = $('#header-date');
  const sidebar = $('#sidebar');
  const menuToggle = $('#menu-toggle');
  const sidebarClose = $('#sidebar-close');
  const categoryFilters = $('#category-filters');
  const toastContainer = $('#toast-container');
  const btnClearCompleted = $('#btn-clear-completed');

  // --- Utility Functions ---
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
    if (date < today) return 'Overdue';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  function getDueClass(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return 'overdue';
    if (date.getTime() === today.getTime()) return 'today';
    return '';
  }

  function setHeaderDate() {
    const now = new Date();
    headerDate.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // --- Storage ---
  function saveTodos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }

  function loadTodos() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        todos = JSON.parse(stored);
      }
    } catch (e) {
      todos = [];
    }
  }

  // --- Toast Notifications ---
  function showToast(message, type = 'info') {
    const icons = {
      success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#10b981" stroke-width="2" stroke-linecap="round"/><path d="M22 4L12 14.01l-3-3" stroke="#10b981" stroke-width="2" stroke-linecap="round"/></svg>`,
      error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#f43f5e" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="#f43f5e" stroke-width="2" stroke-linecap="round"/></svg>`,
      info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#8b5cf6" stroke-width="2"/><path d="M12 16v-4M12 8h.01" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round"/></svg>`,
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('leaving');
      toast.addEventListener('animationend', () => toast.remove());
    }, 2800);
  }

  // --- CRUD Operations ---
  function addTodo(title, category, priority, dueDate) {
    const todo = {
      id: generateId(),
      title: title.trim(),
      category,
      priority,
      dueDate: dueDate || null,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    todos.unshift(todo);
    saveTodos();
    render();
    showToast('Task added successfully', 'success');
  }

  function toggleTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      saveTodos();
      render();
      if (todo.completed) {
        showToast('Task completed! 🎉', 'success');
      }
    }
  }

  function deleteTodo(id) {
    const item = taskList.querySelector(`[data-id="${id}"]`);
    if (item) {
      item.classList.add('removing');
      item.addEventListener('animationend', () => {
        todos = todos.filter((t) => t.id !== id);
        saveTodos();
        render();
        showToast('Task deleted', 'error');
      });
    }
  }

  function updateTodo(id, updates) {
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      Object.assign(todo, updates);
      saveTodos();
      render();
      showToast('Task updated', 'info');
    }
  }

  function clearCompleted() {
    const count = todos.filter((t) => t.completed).length;
    if (count === 0) {
      showToast('No completed tasks to clear', 'info');
      return;
    }
    todos = todos.filter((t) => !t.completed);
    saveTodos();
    render();
    showToast(`Cleared ${count} completed task${count > 1 ? 's' : ''}`, 'success');
  }

  // --- Filtering ---
  function getFilteredTodos() {
    let filtered = [...todos];

    // Apply filter
    switch (currentFilter) {
      case 'active':
        filtered = filtered.filter((t) => !t.completed);
        break;
      case 'completed':
        filtered = filtered.filter((t) => t.completed);
        break;
      case 'high':
      case 'medium':
      case 'low':
        filtered = filtered.filter((t) => t.priority === currentFilter);
        break;
      default:
        // Check if it's a category filter
        if (CATEGORIES.includes(currentFilter)) {
          filtered = filtered.filter((t) => t.category === currentFilter);
        }
        break;
    }

    // Apply search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }

    return filtered;
  }

  // --- Rendering ---
  function createTaskElement(todo) {
    const li = document.createElement('li');
    li.className = `task-item${todo.completed ? ' completed' : ''}`;
    li.dataset.id = todo.id;
    li.dataset.priority = todo.priority;
    li.setAttribute('role', 'listitem');

    const dueDateFormatted = formatDate(todo.dueDate);
    const dueClass = getDueClass(todo.dueDate);

    li.innerHTML = `
      <label class="task-checkbox">
        <input type="checkbox" ${todo.completed ? 'checked' : ''} aria-label="Toggle ${todo.title}" />
        <span class="checkmark">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </label>
      <div class="task-content">
        <span class="task-title">${escapeHtml(todo.title)}</span>
        <div class="task-meta">
          <span class="task-category-tag" data-cat="${todo.category}">${CATEGORY_ICONS[todo.category] || ''} ${todo.category}</span>
          ${
            dueDateFormatted
              ? `<span class="task-due ${dueClass}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                  ${dueDateFormatted}
                </span>`
              : ''
          }
        </div>
      </div>
      <div class="task-actions">
        <button class="task-action-btn edit" title="Edit task" aria-label="Edit ${todo.title}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="task-action-btn delete" title="Delete task" aria-label="Delete ${todo.title}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    `;

    // Event listeners
    li.querySelector('input[type="checkbox"]').addEventListener('change', () => toggleTodo(todo.id));
    li.querySelector('.edit').addEventListener('click', () => openEditModal(todo.id));
    li.querySelector('.delete').addEventListener('click', () => deleteTodo(todo.id));

    return li;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function render() {
    const filtered = getFilteredTodos();

    // Render task list
    taskList.innerHTML = '';
    filtered.forEach((todo, i) => {
      const el = createTaskElement(todo);
      el.style.animationDelay = `${i * 40}ms`;
      taskList.appendChild(el);
    });

    // Toggle empty state
    if (filtered.length === 0) {
      emptyState.classList.add('visible');
    } else {
      emptyState.classList.remove('visible');
    }

    updateBadges();
    updateStats();
    updateCategoryFilters();
  }

  function updateBadges() {
    const all = todos.length;
    const active = todos.filter((t) => !t.completed).length;
    const completed = todos.filter((t) => t.completed).length;
    const high = todos.filter((t) => t.priority === 'high').length;
    const medium = todos.filter((t) => t.priority === 'medium').length;
    const low = todos.filter((t) => t.priority === 'low').length;

    $('#badge-all').textContent = all;
    $('#badge-active').textContent = active;
    $('#badge-completed').textContent = completed;
    $('#badge-high').textContent = high;
    $('#badge-medium').textContent = medium;
    $('#badge-low').textContent = low;
  }

  function updateStats() {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    progressRing.setAttribute('stroke-dasharray', `${percent}, 100`);
    statsPercent.textContent = `${percent}%`;
    statsDetail.textContent = `${completed} of ${total} task${total !== 1 ? 's' : ''}`;
  }

  function updateCategoryFilters() {
    const usedCategories = [...new Set(todos.map((t) => t.category))];
    categoryFilters.innerHTML = '';

    usedCategories.forEach((cat) => {
      const count = todos.filter((t) => t.category === cat).length;
      const btn = document.createElement('button');
      btn.className = `nav-item${currentFilter === cat ? ' active' : ''}`;
      btn.dataset.filter = cat;
      btn.innerHTML = `
        <span>${CATEGORY_ICONS[cat] || '📁'}</span>
        <span>${cat}</span>
        <span class="nav-badge">${count}</span>
      `;
      btn.addEventListener('click', () => setFilter(cat));
      categoryFilters.appendChild(btn);
    });
  }

  // --- Filter Navigation ---
  function setFilter(filter) {
    currentFilter = filter;

    // Update active nav item
    $$('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.filter === filter);
    });

    // Update view title
    const titles = {
      all: 'All Tasks',
      active: 'Active Tasks',
      completed: 'Completed Tasks',
      high: 'High Priority',
      medium: 'Medium Priority',
      low: 'Low Priority',
    };
    viewTitle.textContent = titles[filter] || filter;

    render();
    closeSidebar();
  }

  // --- Priority Selector ---
  function setupPrioritySelector(container, defaultPriority = 'low') {
    const buttons = container.querySelectorAll('.priority-btn');
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.priority === defaultPriority);
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function getSelectedPriority(container) {
    const active = container.querySelector('.priority-btn.active');
    return active ? active.dataset.priority : 'low';
  }

  // --- Edit Modal ---
  function openEditModal(id) {
    editingId = id;
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    editId.value = todo.id;
    editTitle.value = todo.title;
    editCategory.value = todo.category;
    editDue.value = todo.dueDate || '';

    // Set priority
    editPriorityGroup.querySelectorAll('.priority-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.priority === todo.priority);
    });

    editModal.classList.add('open');
    editTitle.focus();
  }

  function closeEditModal() {
    editModal.classList.remove('open');
    editingId = null;
  }

  // --- Sidebar ---
  function openSidebar() {
    sidebar.classList.add('open');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
  }

  // --- Event Listeners ---
  function init() {
    loadTodos();
    setHeaderDate();
    setupPrioritySelector(prioritySelector, 'low');
    setupPrioritySelector(editPriorityGroup, 'low');

    // Add task form
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = taskInput.value.trim();
      if (!title) return;

      const category = taskCategory.value;
      const priority = getSelectedPriority(prioritySelector);
      const dueDate = taskDue.value || null;

      addTodo(title, category, priority, dueDate);

      // Reset form
      taskInput.value = '';
      taskDue.value = '';
      setupPrioritySelector(prioritySelector, 'low');
      taskInput.focus();
    });

    // Search
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
    });

    // Filter navigation
    $$('.sidebar-nav .nav-item[data-filter]').forEach((item) => {
      item.addEventListener('click', () => setFilter(item.dataset.filter));
    });

    // Clear completed
    btnClearCompleted.addEventListener('click', clearCompleted);

    // Edit modal
    $('#modal-close').addEventListener('click', closeEditModal);
    $('#btn-cancel-edit').addEventListener('click', closeEditModal);

    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeEditModal();
    });

    editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!editingId) return;

      updateTodo(editingId, {
        title: editTitle.value.trim(),
        category: editCategory.value,
        priority: getSelectedPriority(editPriorityGroup),
        dueDate: editDue.value || null,
      });

      closeEditModal();
    });

    // Sidebar toggle
    menuToggle.addEventListener('click', openSidebar);
    sidebarClose.addEventListener('click', closeSidebar);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeEditModal();
        closeSidebar();
      }
      // Ctrl/Cmd + K for search focus
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
      }
    });

    render();
  }

  // --- Boot ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
