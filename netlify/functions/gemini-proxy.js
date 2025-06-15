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
    const { posts, analysisType } = JSON.parse(event.body);
    let prompt;

    // The handler can now process two different types of requests
    if (analysisType === 'insights') {
      // For insights, the "posts" array contains a single pre-formatted prompt
      prompt = posts[0];
    } else {
      // This is the main sentiment analysis prompt with a strict schema
      prompt = `You are a social media text analysis expert. For each of the following social media posts, provide a sentiment analysis.
Your response MUST be a single JSON object.
The JSON object should have a single key "posts", which is an array of objects.
Each object in the "posts" array MUST have the following three keys:
1. "text": The original, unmodified post text.
2. "sentiment": Your classification, which must be one of "Positive", "Negative", "Neutral", or "Mixed".
3. "justification": A brief, one-sentence explanation for your sentiment classification.

Analyze these posts:
${posts.join("\n-----\n")}`;
    }

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
