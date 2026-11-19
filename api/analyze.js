/**
 * Vercel Serverless Function: /api/analyze
 *
 * Why this file exists:
 * Browser JavaScript is public — anyone can open DevTools and see it.
 * Keeping your Gemini API call on the server ensures GEMINI_API_KEY
 * stays secret inside Vercel's Environment Variables.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Builds the improved system prompt based on the selected mode.
 * Both modes enforce strict JSON output and prohibit inventing facts.
 */
function buildSystemPrompt(mode) {
  const isFreshGrad = mode === "fresh_grad";

  const roleDescription = isFreshGrad
    ? `You are an expert career advisor and technical recruiter specializing in fresh graduates, college students, and entry-level candidates.
Focus carefully on:
- Academic projects and capstone work
- Programming languages, frameworks, and technical skills
- Internships, part-time roles, and volunteer experience
- Certifications and relevant coursework
- Soft skills and college/club leadership activities
- Entry-level and internship job requirements
Do NOT penalize the candidate heavily for limited full-time work experience if they are a student or fresh graduate. Instead, evaluate how well their projects, skills, and coursework align with the target role.`
    : `You are an expert career coach, ATS (Applicant Tracking System) specialist, and senior technical recruiter.
Evaluate how well the candidate's resume matches the target job description across technical skills, soft skills, relevant experience, measurable impact, and ATS keyword alignment.`;

  const jsonSchema = isFreshGrad
    ? `{
  "ats_score": 0,
  "summary": "",
  "matching_skills": [],
  "missing_skills": [],
  "missing_keywords": [],
  "project_strengths": [],
  "resume_strengths": [],
  "weaknesses": [],
  "improvements": []
}`
    : `{
  "ats_score": 0,
  "summary": "",
  "matching_skills": [],
  "missing_skills": [],
  "missing_keywords": [],
  "strengths": [],
  "weaknesses": [],
  "improvements": []
}`;

  return `${roleDescription}

Your task: Compare ONLY the provided Candidate Resume against ONLY the provided Job Description.

Strict Rules:
1. Return ONLY valid JSON matching the exact schema below. Do NOT include Markdown, code fences, or any text outside the JSON object.
2. NEVER invent, assume, or hallucinate experience, skills, education, certifications, metrics, or projects that are not explicitly written in the resume.
3. "ats_score" must be an integer from 0 to 100 reflecting realistic ATS keyword, skill, and qualification alignment.
4. "summary" must be concise (2-3 sentences), grounded in specific evidence from the resume and job description.
5. "matching_skills" must list concrete technical and soft skills present in BOTH the resume and the job description.
6. "missing_skills" must list required or preferred skills from the job description that are absent from the resume.
7. "missing_keywords" must list exact important terms, tools, frameworks, or domain phrases from the job description missing in the resume.
8. Every item in "weaknesses" and "improvements" must be specific, actionable, and tied to a real gap or phrasing issue in the resume (avoid generic advice like "add more details").
9. Keep array items concise (short bullet-style sentences or keyword phrases).

Required JSON Schema:
${jsonSchema}`;
}

/**
 * Extracts and parses JSON safely even if a model wraps output in extra text.
 */
function parseModelJson(rawText) {
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("The AI did not return valid JSON.");
    }
    return JSON.parse(match[0]);
  }
}

/**
 * Ensures array fields are always arrays of strings and ats_score is 0..100.
 */
function normalizeAnalysis(data, mode) {
  const toStringArray = (val) =>
    Array.isArray(val) ? val.map((item) => String(item).trim()).filter(Boolean) : [];

  const rawScore = Number(data.ats_score);
  const atsScore = Number.isFinite(rawScore)
    ? Math.min(100, Math.max(0, Math.round(rawScore)))
    : 0;

  const base = {
    mode,
    ats_score: atsScore,
    summary: typeof data.summary === "string" ? data.summary.trim() : "",
    matching_skills: toStringArray(data.matching_skills),
    missing_skills: toStringArray(data.missing_skills),
    missing_keywords: toStringArray(data.missing_keywords),
    weaknesses: toStringArray(data.weaknesses),
    improvements: toStringArray(data.improvements),
  };

  if (mode === "fresh_grad") {
    base.project_strengths = toStringArray(data.project_strengths);
    base.resume_strengths = toStringArray(data.resume_strengths);
    // Provide unified strengths array as well for convenience
    base.strengths =
      base.resume_strengths.length > 0
        ? base.resume_strengths
        : toStringArray(data.strengths);
  } else {
    base.strengths = toStringArray(data.strengths);
  }

  return base;
}

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  // Read the secret API key from Vercel's server environment
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "Server configuration error: GEMINI_API_KEY environment variable is not set.",
    });
  }

  // Parse request body safely
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON request body." });
    }
  }

  const resume = typeof body?.resume === "string" ? body.resume.trim() : "";
  const jobDesc = typeof body?.jobDesc === "string" ? body.jobDesc.trim() : "";
  const mode = body?.mode === "fresh_grad" ? "fresh_grad" : "general";

  if (!resume || !jobDesc) {
    return res.status(400).json({
      error: "Both 'resume' and 'jobDesc' fields are required.",
    });
  }

  if (resume.length < 50 || jobDesc.length < 50) {
    return res.status(400).json({
      error:
        "Please provide the full resume and complete job description (at least 50 characters each).",
    });
  }

  const systemPrompt = buildSystemPrompt(mode);
  const userPrompt = `CANDIDATE RESUME:\n"""\n${resume}\n"""\n\nTARGET JOB DESCRIPTION:\n"""\n${jobDesc}\n"""`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      const apiMsg =
        data?.error?.message || `Gemini API returned status ${geminiResponse.status}`;
      return res.status(geminiResponse.status >= 400 ? geminiResponse.status : 502).json({
        error: apiMsg,
      });
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(502).json({
        error: "Gemini returned an empty response. Please try again.",
      });
    }

    const parsed = parseModelJson(rawText);
    const normalized = normalizeAnalysis(parsed, mode);

    return res.status(200).json(normalized);
  } catch (err) {
    console.error("Analyze API error:", err);
    return res.status(500).json({
      error: err.message || "Unexpected error while analyzing the resume.",
    });
  }
};
