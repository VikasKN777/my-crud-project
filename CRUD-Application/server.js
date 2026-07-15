const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client')));

function loadUsersFromCsv() {
  const filePath = path.join(__dirname, 'data', 'login-credentials.csv');
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  if (lines.length < 2) {
    return [];
  }

  const header = lines[0].split(',');
  return lines.slice(1).map((line, index) => {
    const values = line.split(',');
    const entry = {};
    header.forEach((key, idx) => {
      entry[key.trim()] = values[idx] ? values[idx].trim() : '';
    });
    entry.id = index + 1;
    return entry;
  });
}

const users = loadUsersFromCsv();

const initialTasks = [
  { id: 1, title: 'Set up the app', description: 'Create the initial project structure', completed: true, owner: 'demo' },
  { id: 2, title: 'Build a task board', description: 'Add create, edit, and delete flows', completed: false, owner: 'demo' }
];

let tasks = [...initialTasks];
let nextTaskId = 3;
const tokens = new Map();

function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return '';
  }
  return authHeader.slice(7);
}

function authenticate(req, res, next) {
  const token = extractToken(req);
  const user = token ? tokens.get(token) : null;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.user = user;
  next();
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = users.find((entry) => entry.username === username && entry.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = `token-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  tokens.set(token, { id: user.id, username: user.username });

  return res.json({
    token,
    user: { id: user.id, username: user.username }
  });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  const token = extractToken(req);
  tokens.delete(token);
  return res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  return res.json({ user: req.user });
});

app.get('/api/tasks', authenticate, (req, res) => {
  return res.json(tasks.filter((task) => task.owner === req.user.username));
});

app.get('/api/tasks/:id', authenticate, (req, res) => {
  const taskId = Number(req.params.id);
  const task = tasks.find((entry) => entry.id === taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (task.owner !== req.user.username) {
    return res.status(403).json({ error: 'You do not have access to this task' });
  }

  return res.json(task);
});

app.post('/api/tasks', authenticate, (req, res) => {
  const { title, description, completed = false } = req.body || {};

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  const task = {
    id: nextTaskId++,
    title,
    description,
    completed,
    owner: req.user.username
  };

  tasks.push(task);
  return res.status(201).json(task);
});

app.put('/api/tasks/:id', authenticate, (req, res) => {
  const taskId = Number(req.params.id);
  const task = tasks.find((entry) => entry.id === taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const { title, description, completed } = req.body || {};

  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (completed !== undefined) task.completed = completed;

  return res.json(task);
});

app.delete('/api/tasks/:id', authenticate, (req, res) => {
  const taskId = Number(req.params.id);
  const initialLength = tasks.length;
  tasks = tasks.filter((task) => task.id !== taskId);

  if (tasks.length === initialLength) {
    return res.status(404).json({ error: 'Task not found' });
  }

  return res.json({ message: 'Task deleted successfully' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
