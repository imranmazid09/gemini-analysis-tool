const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event) {
  if (!process.env.GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not found." })};
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const { task, post, reportData } = JSON.parse(event.body);
    let prompt;
    let responseData;

    if (task === 'analyze_post') {
      prompt = `You are a social media text analysis expert. Analyze the following single social media post.
        Your response MUST be a single, clean JSON object with two keys:
        1. "sentiment": Your classification, which must be one of "Positive", "Negative", "Neutral", or "Mixed".
        2. "justification": A brief, one-sentence explanation for your sentiment classification.

        Post to analyze: "${post}"
      `;
      // This inner try-catch handles errors from the AI model itself (e.g., on unsafe content)
      try {
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          const jsonStartIndex = text.indexOf('{');
          const jsonEndIndex = text.lastIndexOf('}');
          if (jsonStartIndex === -1 || jsonEndIndex === -1) {
            throw new Error("Invalid non-JSON response from AI.");
          }
          const jsonString = text.substring(jsonStartIndex, jsonEndIndex + 1);
          responseData = JSON.parse(jsonString);
      } catch (aiError) {
          console.error("AI Model Error:", aiError);
          // Return a structured error so the front-end knows this specific post failed
          responseData = { sentiment: "Failed", justification: "The AI model could not process this specific post." };
      }

    } else if (task === 'generate_report') {
      prompt = `You are a university professor specializing in public relations research, writing a report for undergraduate students.
        Based on the following data summary from a sentiment analysis tool, you will perform two tasks.
        
        Data Summary:
        - Total posts submitted for analysis: ${reportData.totalPosts}
        - Posts successfully analyzed: ${reportData.successfulPosts}
        - Sentiment Breakdown: Positive: ${reportData.sentimentCounts.Positive}, Negative: ${reportData.sentimentCounts.Negative}, Neutral: ${reportData.sentimentCounts.Neutral}, Mixed: ${reportData.sentimentCounts.Mixed}.
        
        Your response MUST be a single, clean JSON object with two keys: "strategic_insights" and "technical_explanation".
        
        1. "strategic_insights": This key should contain an object with two keys:
           - "summary": A paragraph starting with "What these results mean...". This should be a concise summary of the overall sentiment distribution from the data provided.
           - "insights_list": An array of exactly three strings. Each string should be a distinct, actionable strategic insight for a public relations or advertising professional.
        
        2. "technical_explanation": This key should contain an object with two keys:
           - "computational_techniques": A single string explaining that the analysis used the Google Gemini model and a resilient streaming approach.
           - "data_analysis_process": An array of three strings explaining the steps of modern, AI-based sentiment analysis for a student audience. For example, explain that unlike simple keyword matching, the AI understands context, nuance, and the relationships between words to determine the overall emotional tone.
      `;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
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
      body: JSON.stringify({ error: `An error occurred inside the function: ${error.message}` }),
    };
  }
};
