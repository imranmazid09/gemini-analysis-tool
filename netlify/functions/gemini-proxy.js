const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event) {
  if (!process.env.GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not found." })};
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const { posts } = JSON.parse(event.body);

    // This is the new, all-in-one prompt for a single, reliable call.
    const prompt = `
      You are an expert social media research assistant for a university professor, tasked with analyzing a list of social media posts.
      Your response MUST be a single, clean JSON object containing a complete report.

      The JSON object must have three top-level keys: "post_analysis", "strategic_insights", and "technical_explanation".

      1. "post_analysis": This MUST be an array of objects. Each object represents a post and MUST have the following keys:
         - "text": The original, unmodified post text.
         - "sentiment": Your classification ("Positive", "Negative", "Neutral", "Mixed"). If a post cannot be processed for any reason (e.g., content policy, ambiguity), the sentiment MUST be "Failed".
         - "justification": A brief, one-sentence explanation for the classification. For failed posts, this should explain the reason for the failure (e.g., "The content was too ambiguous to determine a clear sentiment.").

      2. "strategic_insights": This MUST be an object with two keys:
         - "summary": A paragraph starting with "What these results mean...". Summarize the overall sentiment distribution based on your analysis.
         - "insights_list": An array of exactly three strings, each being a distinct, actionable strategic insight for a public relations or advertising professional.

      3. "technical_explanation": This MUST be an object with two keys:
         - "computational_techniques": A single string explaining that the analysis used a large language model (Google Gemini) to interpret context, nuance, and tone, which is more advanced than simple keyword matching.
         - "data_analysis_process": An array of three strings for a student audience, explaining the steps: 1) The model reads each post to understand its semantic meaning. 2) It evaluates the emotional tone based on word choice, context, and emojis. 3) It assigns a sentiment category and generates a justification for its reasoning.

      Analyze the following ${posts.length} posts:
      ${posts.map((p, i) => `Post ${i+1}: "${p}"`).join('\n')}
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Clean and parse the response
    const jsonStartIndex = text.indexOf('{');
    const jsonEndIndex = text.lastIndexOf('}');
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      throw new Error("Invalid non-JSON response from AI.");
    }
    const jsonString = text.substring(jsonStartIndex, jsonEndIndex + 1);
    const responseData = JSON.parse(jsonString);

    return {
      statusCode: 200,
      body: JSON.stringify(responseData),
    };
    
  } catch (error) {
    console.error("Error in Netlify function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `An error occurred inside the function: ${error.message}` }),
    };
  }
};
