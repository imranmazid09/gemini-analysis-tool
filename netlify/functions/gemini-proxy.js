const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key not found in environment." }),
    };
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const { posts } = JSON.parse(event.body);

    // This is the new, all-in-one prompt
    const prompt = `
      You are a helpful, expert social media research assistant for a university professor.
      Your task is to analyze a series of social media posts and provide a complete report in a single, clean JSON object.

      The final JSON object MUST have two top-level keys: "post_analysis" and "strategic_insights".

      1.  The "post_analysis" key must contain an array of objects, where each object represents a single post and has the following three keys:
          - "text": The original, unmodified post text.
          - "sentiment": Your classification, which must be one of "Positive", "Negative", "Neutral", or "Mixed".
          - "justification": A brief, one-sentence explanation for your sentiment classification.

      2.  The "strategic_insights" key must contain an object with two keys:
          - "summary": A paragraph starting with "What these results mean...". This should be a concise summary of the overall sentiment distribution.
          - "insights_list": An array of exactly three strings. Each string should be a distinct, actionable strategic insight for a public relations or advertising professional, based on the analysis.

      Here are the posts to analyze:
      ${posts.join("\n-----\n")}
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return {
      statusCode: 200,
      body: text,
    };
    
  } catch (error) {
    console.error("Error during function execution:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "An error occurred inside the function." }),
    };
  }
};
