// GitHub match: reads a builder's public repos once and maps their languages,
// topics and descriptions onto Devpost themes with a fixed, explainable dictionary.

const THEME_WORDS = {
  'Machine Learning/AI': ['ai', 'ml', 'llm', 'gpt', 'claude', 'openai', 'model', 'neural', 'agent', 'agents', 'nlp', 'vision', 'pytorch', 'tensorflow', 'jupyter notebook', 'learning', 'rag', 'embedding', 'whisper', 'diffusion'],
  'Web': ['javascript', 'typescript', 'html', 'css', 'react', 'vue', 'svelte', 'astro', 'next', 'nextjs', 'web', 'website', 'pwa', 'frontend'],
  'Mobile': ['swift', 'kotlin', 'dart', 'flutter', 'android', 'ios', 'react-native', 'mobile', 'app'],
  'Health': ['health', 'nutrition', 'meal', 'fitness', 'training', 'medical', 'sleep', 'diet', 'workout', 'strava', 'garmin', 'heat'],
  'Education': ['learn', 'learning', 'study', 'exam', 'flashcard', 'quiz', 'course', 'lecture', 'drill', 'tutor', 'education'],
  'Social Good': ['climate', 'volunteer', 'community', 'neighbour', 'neighbor', 'farm', 'farmers', 'sustainability', 'accessibility', 'charity', 'food'],
  'Productivity': ['productivity', 'task', 'todo', 'calendar', 'notes', 'obsidian', 'automation', 'workflow', 'planner', 'cockpit'],
  'Fintech': ['finance', 'money', 'invoice', 'budget', 'payment', 'bank', 'price', 'prices', 'deal', 'deals'],
  'Gaming': ['game', 'gaming', 'unity', 'godot', 'pet', 'play'],
  'Design': ['design', 'ui', 'ux', 'figma', 'cad', 'laser', '3d', 'blender', 'svg', 'visualisation', 'visualization'],
  'IoT': ['iot', 'esp32', 'arduino', 'raspberry', 'sensor', 'hardware', 'robot', 'robotics', 'drone', 'c++'],
  'Music/Art': ['music', 'guitar', 'audio', 'art', 'video', 'animation', 'chord'],
  'Communication': ['chat', 'messaging', 'email', 'outreach', 'social'],
  'Open Ended': [],
  'Beginner Friendly': [],
};

const tokens = (s) => String(s || '').toLowerCase().split(/[^a-z0-9+#.-]+/).filter(Boolean);

export async function fetchRepos(user) {
  const key = `winnable:gh:${user.toLowerCase()}`;
  try {
    const hit = JSON.parse(localStorage.getItem(key) || 'null');
    if (hit && Date.now() - hit.at < 864e5) return hit.repos;
  } catch { /* ignore broken cache */ }
  const r = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`);
  if (r.status === 404) throw new Error('No GitHub user with that name.');
  if (r.status === 403 || r.status === 429) throw new Error('GitHub is rate-limiting this network. Try again in an hour.');
  if (!r.ok) throw new Error(`GitHub answered ${r.status}.`);
  const repos = (await r.json()).filter((x) => !x.fork).map((x) => ({
    name: x.name, url: x.html_url, language: x.language, topics: x.topics || [], description: x.description || '',
  }));
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), repos })); } catch { /* quota */ }
  return repos;
}

// For each theme: which repos speak to it
export function themeIndex(repos) {
  const index = {};
  for (const repo of repos) {
    const words = new Set([...tokens(repo.name.replace(/[-_]/g, ' ')), ...tokens(repo.description), ...repo.topics.map((t) => t.toLowerCase()), ...(repo.language ? [repo.language.toLowerCase()] : [])]);
    for (const [theme, list] of Object.entries(THEME_WORDS)) {
      if (list.some((w) => words.has(w))) (index[theme] ||= []).push(repo.name);
    }
  }
  return index;
}

// Repos that fit a hackathon's themes (Open Ended and Beginner Friendly never count on their own)
export function matchFor(h, index) {
  const names = new Set();
  const themes = [];
  for (const t of h.themes || []) {
    if (index[t]?.length) { themes.push(t); index[t].forEach((n) => names.add(n)); }
  }
  return { themes, repos: [...names].slice(0, 4) };
}
