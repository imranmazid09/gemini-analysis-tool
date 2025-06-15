import { GoogleGenerativeAI } from "@google/generative-ai";

export const handler = async (event) => {
  console.log("LOG 1: Function starting...");

  if (!process.env.GEMINI_API_KEY) {
    console.error("LOG 2: API key not found.");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key not found in environment." }),
    };
  }
  console.log("LOG 3: API key found.");

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const { posts, analysisType } = JSON.parse(event.body);
    console.log(`LOG 4: Received ${posts.length} posts for ${analysisType} analysis.`);

    const prompt = `You are a social media text analysis expert. Analyze the following posts for ${analysisType}. Provide results as a single JSON object. Posts: ${posts.join("\n")}`;

    console.log("LOG 5: Calling Gemini API...");
    const result = await model.generateContent(prompt);
    console.log("LOG 6: Gemini API call finished.");

    const response = result.response;
    const text = response.text();

    return { statusCode: 200, body: text };

  } catch (error) {
    console.error("LOG 7: Error during function execution:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "An error occurred inside the function." }),
    };
  }
};
