document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const textInput = document.getElementById('textInput');
    const fileUpload = document.getElementById('fileUpload');
    const postCountInfo = document.getElementById('postCountInfo');
    const analysisTypeRadios = document.querySelectorAll('input[name="analysisType"]');
    const analyzeButton = document.getElementById('analyzeButton');
    const resetButton = document.getElementById('resetButton');
    const controlsSentiment = document.getElementById('controlsSentiment');
    const outputArea = document.getElementById('outputArea');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const activeAnalysisTitle = document.getElementById('activeAnalysisTitle');
    const summaryContentPlaceholder = document.getElementById('summaryContentPlaceholder');
    const visualizationPlaceholder = document.getElementById('visualizationPlaceholder');
    const interpretationPlaceholder = document.getElementById('interpretationPlaceholder');
    const technicalReportContentPlaceholder = document.getElementById('technicalReportContentPlaceholder');

    let sentimentChartInstance = null;
    const MAX_POSTS = 500;
    let currentPosts = [];

    // --- Event Listeners and Helper Functions ---
    textInput.addEventListener('input', () => { currentPosts = getPostsFromInput(textInput.value); updatePostCountDisplay(currentPosts.length); });
    fileUpload.addEventListener('change', handleFileUpload);
    analysisTypeRadios.forEach(radio => { radio.addEventListener('change', function () { updateControlPanels(); clearOutputSections(); outputArea.style.display = 'none'; }); });
    analyzeButton.addEventListener('click', performAnalysis);
    resetButton.addEventListener('click', resetTool);

    function getPostsFromInput(rawText) {
        let posts;
        if (rawText.includes('\n\n') || rawText.includes('\r\n\r\n')) { posts = rawText.split(/\n\s*\n+/).map(p => p.trim()).filter(p => p !== ''); } 
        else { posts = rawText.split(/\n|\r\n/).map(p => p.trim()).filter(p => p !== ''); }
        return posts;
    }
    function updatePostCountDisplay(count) {
        postCountInfo.textContent = `Posts detected: ${count}`;
        postCountInfo.style.color = count > MAX_POSTS ? 'red' : '#555';
        if (count > MAX_POSTS) { postCountInfo.textContent += ` (Warning: Using first ${MAX_POSTS} posts due to limit.)`; }
    }
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = error => reject(error);
            reader.readAsText(file, 'UTF-8');
        });
    }
    async function handleFileUpload(event) {
        const file = event.target.files[0]; if (!file) return;
        showLoading('Reading file...');
        try {
            const rawFileContent = await readFileAsText(file);
            textInput.value = rawFileContent;
            currentPosts = getPostsFromInput(textInput.value);
            updatePostCountDisplay(currentPosts.length);
        } catch (error) {
            alert("Error reading file."); console.error("File Read Error:", error);
        } finally {
            hideLoading();
        }
    }
    function updateControlPanels() {
        document.querySelectorAll('.analysis-controls').forEach(el => el.classList.remove('active'));
        const selectedType = document.querySelector('input[name="analysisType"]:checked').value;
        document.getElementById(`controls${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}`).classList.add('active');
    }
    function clearOutputSections() {
        summaryContentPlaceholder.innerHTML = '<p>Summary of the analysis will appear here...</p>';
        visualizationPlaceholder.innerHTML = '';
        interpretationPlaceholder.innerHTML = '';
        technicalReportContentPlaceholder.innerHTML = '';
        if (sentimentChartInstance) { sentimentChartInstance.destroy(); sentimentChartInstance = null; }
    }
    function showLoading(message) { 
        loadingIndicator.querySelector('p').textContent = message;
        analyzeButton.disabled = true; 
        resetButton.disabled = true; 
        loadingIndicator.style.display = 'block'; 
    }
    function hideLoading() { analyzeButton.disabled = false; resetButton.disabled = false; loadingIndicator.style.display = 'none';}
    function resetTool() {
        textInput.value = ''; fileUpload.value = '';
        outputArea.style.display = 'none'; clearOutputSections();
        document.querySelector('input[name="analysisType"][value="sentiment"]').checked = true;
        currentPosts = []; updatePostCountDisplay(0);
    }
    
    // --- NEW Fault-Tolerant Batch Analysis Function ---
    async function performAnalysis() {
        currentPosts = getPostsFromInput(textInput.value);
        if (currentPosts.length === 0) { alert("Please paste or upload some text to analyze."); return; }
        
        const postsToAnalyze = currentPosts.slice(0, MAX_POSTS);
        const BATCH_SIZE = 25;
        const batches = [];
        for (let i = 0; i < postsToAnalyze.length; i += BATCH_SIZE) {
            batches.push(postsToAnalyze.slice(i, i + BATCH_SIZE));
        }

        clearOutputSections();
        summaryContentPlaceholder.innerHTML = ''; // Clear for live results
        outputArea.style.display = 'block';
        
        const analysisTitle = document.querySelector('input[name="analysisType"]:checked').parentElement.textContent.trim();
        activeAnalysisTitle.textContent = analysisTitle;
        
        let allResults = [];
        
        try {
            for (let i = 0; i < batches.length; i++) {
                showLoading(`Analyzing batch ${i + 1} of ${batches.length}...`);
                const response = await fetch('/.netlify/functions/gemini-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ posts: batches[i] }),
                });

                if (!response.ok) {
                    throw new Error(`A critical error occurred on batch ${i + 1} (Server status: ${response.status}).`);
                }
                
                const resultText = await response.text();
                let jsonString = resultText;
                const markdownMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
                if (markdownMatch && markdownMatch[1]) { jsonString = markdownMatch[1]; } 
                else {
                    const jsonStartIndex = jsonString.indexOf('{');
                    const jsonEndIndex = jsonString.lastIndexOf('}');
                    if (jsonStartIndex === -1 || jsonEndIndex === -1) { throw new Error("The AI provided an invalid, non-JSON response."); }
                    jsonString = jsonString.substring(jsonStartIndex, jsonEndIndex + 1);
                }
                
                const resultJson = JSON.parse(jsonString);
                if (resultJson.post_analysis && Array.isArray(resultJson.post_analysis)) {
                    allResults.push(...resultJson.post_analysis);
                } else {
                    console.warn(`Batch ${i + 1} response was missing 'post_analysis' data.`);
                }
            }

            // --- Final Report Generation (Local) ---
            renderFinalReport(allResults, postsToAnalyze.length);

        } catch (error) {
            console.error("Analysis Error:", error);
            summaryContentPlaceholder.innerHTML = `<p class="error-message">A critical error occurred during analysis: ${error.message}</p>`;
        } finally {
            hideLoading();
        }
    }
    
    // --- NEW Final Report Rendering Function ---
    function renderFinalReport(allResults, totalSubmitted) {
        if (allResults.length === 0) {
            summaryContentPlaceholder.innerHTML = `<p class="error-message">The AI could not analyze any of the posts provided.</p>`;
            return;
        }

        // Render post-by-post cards
        summaryContentPlaceholder.innerHTML = '';
        let htmlOutput = '';
        allResults.forEach(post => {
            const sentiment = (post.sentiment || 'N/A').charAt(0).toUpperCase() + (post.sentiment || 'N/A').slice(1).toLowerCase();
            const sentimentClass = sentiment.toLowerCase();
            htmlOutput += `
                <div class="analysis-card card-${sentimentClass}">
                    <blockquote class="post-text">"${post.text}"</blockquote>
                    <p class="post-sentiment"><strong>Sentiment:</strong> <span class="badge badge-${sentimentClass}">${sentiment}</span></p>
                    <p class="post-details"><strong>Justification:</strong> ${post.justification || 'N/A'}</p>
                </div>
            `;
        });
        summaryContentPlaceholder.innerHTML = htmlOutput;

        // Aggregate data for reports
        const sentimentCounts = { Positive: 0, Negative: 0, Neutral: 0, Mixed: 0, Failed: 0 };
        allResults.forEach(post => {
            let sentiment = (post.sentiment || 'N/A').charAt(0).toUpperCase() + post.sentiment.slice(1).toLowerCase();
            if (sentimentCounts.hasOwnProperty(sentiment)) { sentimentCounts[sentiment]++; }
        });
        
        const successfulPosts = allResults.length - sentimentCounts.Failed;

        // Render the visualization
        renderVisualization(sentimentCounts);
        
        // Render the interpretation and technical report using templates
        renderInterpretation(sentimentCounts, successfulPosts, totalSubmitted);
        renderTechnicalReport(sentimentCounts, successfulPosts, totalSubmitted);
    }
    
    function renderVisualization(sentimentCounts) {
        visualizationPlaceholder.innerHTML = '<canvas id="sentimentChart"></canvas>';
        const ctx = document.getElementById('sentimentChart').getContext('2d');
        if (sentimentChartInstance) sentimentChartInstance.destroy();
        sentimentChartInstance = new Chart(ctx, {
            type: 'bar', 
            data: { 
                labels: ['Positive', 'Negative', 'Neutral', 'Mixed', 'Failed'], 
                datasets: [{ 
                    label: 'Number of Posts', 
                    data: [sentimentCounts.Positive, sentimentCounts.Negative, sentimentCounts.Neutral, sentimentCounts.Mixed, sentimentCounts.Failed], 
                    backgroundColor: ['#28a745', '#dc3545', '#6c757d', '#ffc107', '#b91c1c'] 
                }] 
            },
            options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Final Sentiment Distribution' } } }
        });
    }

    function renderInterpretation(sentimentCounts, successfulPosts, totalSubmitted) {
        const positivePercent = successfulPosts > 0 ? ((sentimentCounts.Positive / successfulPosts) * 100).toFixed(1) : 0;
        const negativePercent = successfulPosts > 0 ? ((sentimentCounts.Negative / successfulPosts) * 100).toFixed(1) : 0;
        interpretationPlaceholder.innerHTML = `
            <p><strong>What these results mean</strong></p>
            <p>Out of ${totalSubmitted} posts submitted, ${successfulPosts} were successfully analyzed. Of those analyzed, the conversation is ${positivePercent}% positive and ${negativePercent}% negative. This indicates the general tone of the discussion.</p>
            <p><strong>Example Strategic Insights</strong></p>
            <ul>
                <li><strong>Leverage Positive Themes:</strong> Identify common topics within the 'Positive' posts. These represent what your audience enjoys and can be amplified in future content.</li>
                <li><strong>Address Negative Feedback:</strong> The 'Negative' posts are a valuable source of direct feedback. Analyze the justifications to pinpoint specific issues. Addressing these concerns can turn a negative into a brand-building opportunity.</li>
                <li><strong>Understand Failed Posts:</strong> The ${sentimentCounts.Failed} 'Failed' posts are also a finding. They may represent ambiguous content, unsupported languages, or other data quality issues worth investigating.</li>
            </ul>`;
    }

    function renderTechnicalReport(sentimentCounts, successfulPosts, totalSubmitted) {
        technicalReportContentPlaceholder.innerHTML = `
            <h4>Computational Techniques Used:</h4>
            <p>This analysis used the Google Gemini large language model to interpret each post. Unlike simple keyword matching, this model analyzes the context, nuance, and relationships between words to determine the overall emotional tone. To ensure reliability with large datasets, the posts were processed in efficient, fault-tolerant batches.</p>
            <h4>Process of Data Analysis (Simplified for Reporting):</h4>
            <ol>
                <li>The tool sent ${totalSubmitted} posts to the AI in batches.</li>
                <li>The AI model read each post to understand its semantic meaning and evaluated its emotional tone. It then assigned a sentiment category and generated a justification for its reasoning.</li>
                <li>The tool received and displayed the ${successfulPosts} successful results and noted the ${sentimentCounts.Failed} posts that could not be processed.</li>
                <li>Finally, all successful results were aggregated to generate the final chart and summary reports.</li>
            </ol>`;
    }

    // Initialize the page
    updateControlPanels();
    updatePostCountDisplay(0);
});
