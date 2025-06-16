const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event) {
  if (!process.env.GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not found." })};
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const { task, posts, post, sentiment } = JSON.parse(event.body);
    let prompt;
    let responseData = {};

    if (task === 'categorize') {
      prompt = `For each of the following social media posts, classify the sentiment as "Positive", "Negative", "Neutral", or "Mixed". 
      Your response MUST be a single JSON object with a single key "sentiments", which is an array of strings. 
      The array must have the same number of items as the number of posts I provide.
      
      Posts:
      ${posts.map(p => `- "${p}"`).join('\n')}
      `;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      // Clean and parse the response
      const jsonStartIndex = text.indexOf('{');
      const jsonEndIndex = text.lastIndexOf('}');
      const jsonString = text.substring(jsonStartIndex, jsonEndIndex + 1);
      responseData = JSON.parse(jsonString);

    } else if (task === 'justify') {
      prompt = `The following social media post has been classified with a "${sentiment}" sentiment. 
      Provide a brief, one-sentence justification for this classification.
      Your response MUST be a single JSON object with a single key "justification", which is a string.

      Post: "${post}"
      `;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      // Clean and parse the response
      const jsonStartIndex = text.indexOf('{');
      const jsonEndIndex = text.lastIndexOf('}');
      const jsonString = text.substring(jsonStartIndex, jsonEndIndex + 1);
      responseData = JSON.parse(jsonString);

    } else {
      throw new Error("Invalid task specified.");
    }

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
