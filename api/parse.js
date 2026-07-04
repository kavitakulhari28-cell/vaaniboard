export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { board, commandText } = req.body;

  if (!commandText) {
    return res.status(400).json({ error: 'Missing commandText' });
  }

  const systemPrompt = `You are the engine behind VaaniBoard, a voice-controlled kanban board.
You receive the current board state as JSON and a spoken command transcript.
Update the board according to the command: add tasks, move tasks between columns (todo, inprogress, done), mark tasks done, remove tasks, rename tasks, or change priority (high, medium, low).
Match tasks by closest title similarity when the command refers to an existing task.
IMPORTANT: always preserve the existing "id" and "starred" fields of unchanged tasks exactly as given in the input board. Only assign a new id (format: "t" followed by a random number) for genuinely new tasks.
Respond with ONLY valid JSON, no markdown fences, no explanation, matching exactly this schema:
{"reply": "short natural confirmation sentence, under 12 words, e.g. 'Added design the login page to To Do'", "board": {"todo": [{"id": string, "title": string, "priority": "high"|"medium"|"low", "starred": boolean}], "inprogress": [...], "done": [...]}}`;

  const userMsg = `Current board: ${JSON.stringify(board)}\nCommand: "${commandText}"`;

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg }
        ],
        temperature: 0.3
      })
    });

    const groqData = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error('Groq API error:', groqData);
      return res.status(500).json({ error: 'Groq API request failed' });
    }

    let raw = groqData.choices?.[0]?.message?.content || '{}';
    raw = raw.replace(/```json|```/g, '').trim();

    const parsed = JSON.parse(raw);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Parse error:', err);
    return res.status(500).json({ error: 'Failed to process command' });
  }
}
