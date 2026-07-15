const authCard = document.getElementById('auth-card');
const dashboard = document.getElementById('dashboard');
const userName = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const taskForm = document.getElementById('task-form');
const taskTitle = document.getElementById('task-title');
const taskDescription = document.getElementById('task-description');
const taskCompleted = document.getElementById('task-completed');
const taskList = document.getElementById('task-list');
const taskCount = document.getElementById('task-count');
const formTitle = document.getElementById('form-title');
const cancelEditBtn = document.getElementById('cancel-edit');

let editingTaskId = null;
let user = null;

function renderAuth() {
  if (user) {
    authCard.innerHTML = '';
    dashboard.classList.remove('hidden');
    userName.textContent = `Hello, ${user.username}`;
    return;
  }

  dashboard.classList.add('hidden');
  authCard.innerHTML = `
    <div class="card">
      <p class="eyebrow">Secure sign in</p>
      <h3>Welcome back</h3>
      <form id="login-form">
        <input id="login-username" name="username" placeholder="Username" required />
        <input id="login-password" name="password" type="password" placeholder="Password" required />
        <button class="primary-btn" type="submit">Login</button>
      </form>
      <p style="margin-top: 10px; color: #475467;">Try admin / admin123 or demo / demo123</p>
    </div>
  `;

  const loginForm = document.getElementById('login-form');
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('taskflow-token', data.token);
      user = data.user;
      renderAuth();
      loadTasks();
    } catch (error) {
      alert(error.message);
    }
  });
}

async function loadTasks() {
  const token = localStorage.getItem('taskflow-token');
  if (!token) {
    taskList.innerHTML = '';
    taskCount.textContent = '0 items';
    return;
  }

  try {
    const response = await fetch('/api/tasks', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Unable to load tasks');
    }

    const tasks = await response.json();
    renderTasks(tasks);
  } catch (error) {
    console.error(error);
  }
}

function renderTasks(tasks) {
  taskCount.textContent = `${tasks.length} item${tasks.length === 1 ? '' : 's'}`;
  if (!tasks.length) {
    taskList.innerHTML = '<p>No tasks yet. Create your first task above.</p>';
    return;
  }

  taskList.innerHTML = tasks
    .map((task) => `
      <article class="task-item ${task.completed ? 'completed' : ''}">
        <div>
          <h4>${task.title}</h4>
          <p>${task.description}</p>
        </div>
        <div class="task-actions">
          <button class="secondary-btn" data-action="edit" data-id="${task.id}">Edit</button>
          <button class="secondary-btn" data-action="toggle" data-id="${task.id}">${task.completed ? 'Undo' : 'Done'}</button>
          <button class="secondary-btn" data-action="delete" data-id="${task.id}">Delete</button>
        </div>
      </article>
    `)
    .join('');
}

async function persistTask(taskData) {
  const token = localStorage.getItem('taskflow-token');
  const method = editingTaskId ? 'PUT' : 'POST';
  const url = editingTaskId ? `/api/tasks/${editingTaskId}` : '/api/tasks';

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(taskData)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Unable to save task');
  }

  resetForm();
  loadTasks();
  return data;
}

function resetForm() {
  taskForm.reset();
  editingTaskId = null;
  formTitle.textContent = 'Create a task';
}

logoutBtn.addEventListener('click', async () => {
  const token = localStorage.getItem('taskflow-token');
  if (!token) {
    localStorage.removeItem('taskflow-token');
    user = null;
    renderAuth();
    return;
  }

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (error) {
    console.error(error);
  } finally {
    localStorage.removeItem('taskflow-token');
    user = null;
    renderAuth();
  }
});

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    title: taskTitle.value.trim(),
    description: taskDescription.value.trim(),
    completed: taskCompleted.checked
  };

  try {
    await persistTask(payload);
  } catch (error) {
    alert(error.message);
  }
});

cancelEditBtn.addEventListener('click', resetForm);

taskList.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const taskId = Number(target.dataset.id);
  if (!action || !taskId) {
    return;
  }

  const token = localStorage.getItem('taskflow-token');
  if (!token) {
    return;
  }

  try {
    if (action === 'delete') {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to delete task');
      }
      loadTasks();
    }

    if (action === 'toggle') {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ completed: !target.textContent.includes('Undo') })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update task');
      }
      loadTasks();
    }

    if (action === 'edit') {
      const response = await fetch(`/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to load task');
      }
      editingTaskId = data.id;
      formTitle.textContent = 'Edit task';
      taskTitle.value = data.title;
      taskDescription.value = data.description;
      taskCompleted.checked = data.completed;
      taskTitle.focus();
    }
  } catch (error) {
    alert(error.message);
  }
});

(async function init() {
  const token = localStorage.getItem('taskflow-token');
  if (token) {
    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        user = data.user;
      } else {
        localStorage.removeItem('taskflow-token');
        user = null;
      }
    } catch (error) {
      localStorage.removeItem('taskflow-token');
      user = null;
    }
  }

  renderAuth();
  if (user) {
    loadTasks();
  }
})();
