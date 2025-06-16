const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event) {
  if (!process.env.GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not found." })};
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const { post } = JSON.parse(event.body);

    const prompt = `You are a social media text analysis expert. Analyze the following single social media post.
      Your response MUST be a single JSON object with two keys:
      1. "sentiment": Your classification, which must be one of "Positive", "Negative", "Neutral", or "Mixed".
      2. "justification": A brief, one-sentence explanation for your sentiment classification.

      Post to analyze: "${post}"
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
      body: JSON.stringify({ error: "An error occurred inside the function." }),
    };
  }
};
