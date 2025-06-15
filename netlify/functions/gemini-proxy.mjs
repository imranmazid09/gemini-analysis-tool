import { GoogleGenerativeAI } from "@google/generative-ai";

export const handler = async (event) => {
  // Check for the secret API key in the environment variables
  if (!process.env.GEMINI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key not found in environment." }),
    };
  }

  // Prepare the API client with the secret key
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    // Get the user's data from the browser's request
    const { posts, analysisType } = JSON.parse(event.body);

    // Generate the specific prompt to send to the Gemini API
    const prompt = `You are a social media text analysis expert. Analyze the following ${posts.length} posts for ${analysisType}. Provide the results as a single JSON object.

    Posts:
    ${posts.join("\n")}
    `;

    // Call the Gemini API
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Send the AI's response back to the browser
    return {
      statusCode: 200,
      body: text,
    };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "An error occurred while communicating with the AI.",
      }),
    };
  }
};