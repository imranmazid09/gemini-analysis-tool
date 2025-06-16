const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event) {
  if (!process.env.GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not found." })};
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const { posts } = JSON.parse(event.body);

    // This is the new, more sophisticated prompt designed for reliability.
    const prompt = `
      You are a social media text analysis expert. Your task is to analyze a batch of social media posts.
      Your response MUST be a single, clean JSON object.
      The JSON object must have a single key "post_analysis", which is an array of objects.

      For each post in the batch, create a corresponding object in the "post_analysis" array. Each object MUST have the following three keys:
      1. "text": The original, unmodified post text.
      2. "sentiment": Your classification, which must be one of "Positive", "Negative", "Neutral", or "Mixed".
      3. "justification": A brief, one-sentence explanation for your sentiment classification.

      IMPORTANT RELIABILITY INSTRUCTION: If you encounter a single post that is ambiguous, violates a content policy, or cannot be analyzed for any reason, you MUST still complete the analysis for all other posts. For the single problematic post, you must return a sentiment of "Failed" and a justification explaining the reason (e.g., "The content was too ambiguous to determine a clear sentiment."). A single failed post must not prevent the analysis of the others.

      Analyze this batch of ${posts.length} posts:
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
