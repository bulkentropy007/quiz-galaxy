require('dotenv').config({ path: 'C:\\credentials\\.env' });

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY is not set — question replenishment will be disabled. The built-in 250-question bank will still work.');
}

let anthropic = null;
if (ANTHROPIC_API_KEY) {
  const Anthropic = require('@anthropic-ai/sdk');
  anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/replenish', async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: 'Replenishment unavailable: ANTHROPIC_API_KEY not configured.' });
  }

  const { subject, existingIds } = req.body;
  if (!subject) {
    return res.status(400).json({ error: 'subject is required' });
  }

  const subjectMap = {
    science:     'Science (Grade 4 CBSE: plants, animals, human body, solar system, materials)',
    geography:   'Geography (Grade 4 CBSE: India map, states, rivers, world geography, continents)',
    history:     'History (Grade 4 CBSE: Indian freedom struggle, Mughal era, ancient India, national symbols)',
    mathematics: 'Mathematics (Grade 4 CBSE: fractions, geometry, multiplication, division, measurements)',
    gk:          'General Knowledge (Grade 4: national symbols, famous personalities, sports, science facts, world records)'
  };

  const subjectDescription = subjectMap[subject] || subject;
  const idsText = Array.isArray(existingIds) && existingIds.length > 0
    ? `Do not repeat questions with these IDs: ${existingIds.slice(0, 50).join(', ')}.`
    : '';

  const prompt = `Generate exactly 20 multiple choice questions for Grade 4 CBSE students about ${subjectDescription}. Each question must be age-appropriate (9-10 years), fun, and educational. ${idsText}

Return ONLY a valid JSON array with no markdown, no extra text, no code blocks. Each object must have exactly these fields:
{ "question": string, "options": [string, string, string, string], "correct": number (0-3 index of correct option), "trivia": string (1-2 fun sentences about the answer), "visual": string or null (1-3 relevant emojis or null), "difficulty": "easy" or "medium" or "hard" }

Make sure all 4 options are plausible but only one is correct. Keep language simple and fun for 9-10 year olds.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = message.content[0].text.trim();
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) {
      return res.status(500).json({ error: 'Invalid response format from AI' });
    }

    return res.json(parsed);
  } catch (err) {
    console.error('Replenish error:', err.message);
    return res.status(500).json({ error: 'Failed to generate questions', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Quiz Galaxy server running at http://localhost:${PORT}`);
});
